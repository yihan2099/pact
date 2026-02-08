/**
 * HTTP Server for Pact MCP
 *
 * Exposes MCP tools over HTTP for remote clients (like the mcp-client package)
 * while the stdio transport handles local MCP connections.
 *
 * Also provides:
 * - /mcp endpoint for MCP Streamable HTTP transport (Claude Desktop remote connector)
 * - A2A protocol endpoints (/.well-known/agent-card.json, /a2a)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpRateLimitMiddleware } from '@clawboy/rate-limit/middleware/hono';
import { createMcpServer, type ServerContext } from './server';
import { getSession } from './auth/session-manager';
import { checkAccessWithRegistrationRefresh } from './auth/access-control';
import { listTasksTool } from './tools/task/list-tasks';
import { getTaskTool } from './tools/task/get-task';
import { createTaskTool } from './tools/task/create-task';
import { cancelTaskTool } from './tools/task/cancel-task';
import { submitWorkTool } from './tools/agent/submit-work';
import { getMySubmissionsTool } from './tools/agent/get-my-submissions';
import { registerAgentTool } from './tools/agent/register-agent';
import { updateProfileTool } from './tools/agent/update-profile';
import {
  getDisputeTool,
  listDisputesTool,
  startDisputeTool,
  submitVoteTool,
  resolveDisputeTool,
} from './tools/dispute';
import { getChallengeHandler, verifySignatureHandler, getSessionHandler } from './tools/auth';
import { allTools } from './tools';
import { logAccessDenied, logSecurityEvent } from './services/security-logger';
import { a2aRouter } from './a2a';
import { isUnknownToolError } from './utils/error-sanitizer';
import { toHttpError, ERROR_CODES } from './utils/api-error';
import { getChainId } from './config/chain';

const app = new Hono();

// SECURITY: Validate NODE_ENV against allowlist
const VALID_NODE_ENVS = ['development', 'staging', 'production', 'test'];
const nodeEnv = process.env.NODE_ENV || 'development';
if (!VALID_NODE_ENVS.includes(nodeEnv)) {
  console.error(
    `FATAL: Invalid NODE_ENV value: "${nodeEnv}". ` +
      `Must be one of: ${VALID_NODE_ENVS.join(', ')}`
  );
  process.exit(1);
}

// SECURITY: Configure CORS with allowed origins from environment
// Both production and staging require explicit CORS_ORIGINS
const requireExplicitCors = nodeEnv === 'production' || nodeEnv === 'staging';
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : requireExplicitCors
    ? null // FAIL-CLOSED: null means startup will fail
    : ['*']; // Default to all for development/test only

// SECURITY: Fail-closed in production/staging if CORS_ORIGINS not configured
if (allowedOrigins === null) {
  console.error(
    `FATAL: CORS_ORIGINS environment variable is required in ${nodeEnv}. ` +
      'Set it to a comma-separated list of allowed origins (e.g., "https://pact.dev,https://app.pact.dev"). ' +
      `Server will not start without proper CORS configuration in ${nodeEnv}.`
  );
  process.exit(1);
}

// Validate CORS origins format
if (requireExplicitCors && allowedOrigins) {
  for (const origin of allowedOrigins) {
    if (origin === '*') {
      console.error('SECURITY WARNING: Wildcard CORS origin not allowed in production');
      process.exit(1);
    }
    try {
      new URL(origin);
    } catch {
      console.error(`FATAL: Invalid CORS origin format: "${origin}". Must be a valid URL.`);
      process.exit(1);
    }
  }
}

console.error(
  `CORS origins configured: ${allowedOrigins.includes('*') ? '* (all - development only)' : allowedOrigins.join(', ')}`
);

app.use(
  '/*',
  cors({
    origin: (origin) => {
      // Allow requests with no origin (same-origin, curl, etc.)
      if (!origin) return '*';

      // If no origins configured (production without CORS_ORIGINS), deny all
      if (allowedOrigins.length === 0) return null;

      // If wildcard is allowed, permit all origins
      if (allowedOrigins.includes('*')) return origin;

      // Check if origin is in allowlist
      if (allowedOrigins.includes(origin)) return origin;

      // Reject unknown origins by returning null
      return null;
    },
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'X-Session-Id',
      'Authorization',
      'mcp-session-id',
      'Last-Event-ID',
      'mcp-protocol-version',
    ],
    exposeHeaders: ['mcp-session-id', 'mcp-protocol-version'],
    maxAge: 86400, // Cache preflight for 24 hours
  })
);

// SECURITY: Add security headers to all responses
app.use('/*', async (c, next) => {
  await next();

  // Prevent MIME type sniffing
  c.res.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  c.res.headers.set('X-Frame-Options', 'DENY');

  // Enable XSS filter in older browsers
  c.res.headers.set('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy for API responses
  c.res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

  // Only send over HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Request ID correlation middleware
app.use('/*', async (c, next) => {
  const requestId = c.req.header('X-Request-Id') || crypto.randomUUID();
  await next();
  c.res.headers.set('X-Request-Id', requestId);
});

// SECURITY: Whether to trust proxy headers for client IP detection
// Only enable if behind a trusted reverse proxy that overwrites these headers
const TRUST_PROXY_HEADERS = process.env.TRUST_PROXY_HEADERS === 'true';

// SECURITY: Simple IPv4/IPv6 validation pattern
const IP_PATTERN = /^(?:(?:\d{1,3}\.){3}\d{1,3}|(?:[a-fA-F0-9:]+:+)+[a-fA-F0-9]+)$/;

/**
 * SECURITY: Get client IP address with validation
 *
 * WARNING: x-forwarded-for and x-real-ip headers can be spoofed by attackers
 * unless behind a trusted reverse proxy that overwrites these headers.
 */
function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  if (TRUST_PROXY_HEADERS) {
    const forwarded = c.req.header('x-forwarded-for');
    const realIp = c.req.header('x-real-ip');

    if (forwarded) {
      const clientIp = forwarded.split(',')[0]?.trim();
      if (clientIp && IP_PATTERN.test(clientIp)) {
        return clientIp;
      }
    }

    if (realIp && IP_PATTERN.test(realIp)) {
      return realIp;
    }
  }

  return 'unknown-client';
}

// SECURITY: Body size limit middleware (1MB max for all API routes)
const MAX_BODY_SIZE = 1_048_576; // 1MB in bytes
app.use('/tools/*', async (c, next) => {
  const contentLength = c.req.header('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return c.json({ error: 'Payload Too Large', maxSize: '1MB' }, 413);
  }
  await next();
});
app.use('/a2a', async (c, next) => {
  const contentLength = c.req.header('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return c.json({ error: 'Payload Too Large', maxSize: '1MB' }, 413);
  }
  await next();
});
app.use('/mcp', async (c, next) => {
  const contentLength = c.req.header('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return c.json({ error: 'Payload Too Large', maxSize: '1MB' }, 413);
  }
  await next();
});

// SECURITY: Request logging middleware
app.use('/tools/*', async (c, next) => {
  const start = Date.now();
  const ip = getClientIp(c);
  const toolName = c.req.path.replace('/tools/', '');
  const sessionId = c.req.header('X-Session-Id');

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Log request (structured for log aggregation)
  const requestId = c.res.headers.get('X-Request-Id') || undefined;
  logSecurityEvent({
    type: status >= 400 ? 'access_denied' : 'auth_challenge_requested',
    timestamp: new Date().toISOString(),
    ip,
    toolName,
    sessionId: sessionId || undefined,
    metadata: {
      method: c.req.method,
      status,
      duration,
      requestId,
    },
  });
});

// Rate limiting middleware for tool endpoints
app.use('/tools/*', createMcpRateLimitMiddleware());

// Rate limiting middleware for A2A endpoints
app.use('/a2a', createMcpRateLimitMiddleware());

// ============================================================================
// A2A Protocol Endpoints
// ============================================================================

// Mount A2A router (includes /.well-known/agent-card.json and /a2a)
app.route('/', a2aRouter);

// Health check endpoint
app.get('/health', async (c) => {
  const uptimeSeconds = process.uptime();
  const checks: Record<
    string,
    { status: string; latencyMs?: number; error?: string; blockNumber?: string }
  > = {};

  // Supabase check
  try {
    const start = Date.now();
    const { getSupabaseClient } = await import('@clawboy/database');
    const supabase = getSupabaseClient();
    await supabase.from('tasks').select('id').limit(1);
    checks.supabase = { status: 'ok', latencyMs: Date.now() - start };
  } catch (e) {
    checks.supabase = { status: 'error', error: e instanceof Error ? e.message : 'Unknown' };
  }

  // Redis check
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const start = Date.now();
      const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN || ''}` },
      });
      if (res.ok) {
        checks.redis = { status: 'ok', latencyMs: Date.now() - start };
      } else {
        checks.redis = { status: 'error', error: `HTTP ${res.status}` };
      }
    } catch (e) {
      checks.redis = { status: 'error', error: e instanceof Error ? e.message : 'Unknown' };
    }
  } else {
    checks.redis = { status: 'unavailable', error: 'Redis not configured (using memory fallback)' };
  }

  // RPC check
  try {
    const start = Date.now();
    const { getBlockNumber } = await import('@clawboy/web3-utils');
    const chainId = getChainId();
    const blockNumber = await getBlockNumber(chainId);
    checks.rpc = {
      status: 'ok',
      latencyMs: Date.now() - start,
      blockNumber: blockNumber.toString(),
    };
  } catch (e) {
    checks.rpc = { status: 'error', error: e instanceof Error ? e.message : 'Unknown' };
  }

  const allOk = Object.values(checks).every((ch) => ch.status === 'ok');

  // Read version from package.json
  let version = 'unknown';
  try {
    const pkgPath = new URL('../../package.json', import.meta.url);
    const pkgText = await Bun.file(pkgPath).text();
    const pkg = JSON.parse(pkgText);
    version = pkg.version || 'unknown';
  } catch {
    // ignore
  }

  return c.json({
    status: allOk ? 'ok' : 'degraded',
    service: 'pact-mcp-server',
    version,
    uptime: Math.floor(uptimeSeconds),
    timestamp: new Date().toISOString(),
    dependencies: checks,
  });
});

// ============================================================================
// MCP Streamable HTTP Transport (for Claude Desktop remote connector)
// ============================================================================

// Create transport in stateless mode (no session management needed for serverless)
const mcpTransport = new WebStandardStreamableHTTPServerTransport();
const mcpServer = createMcpServer();

// Connect server to transport (lazy initialization)
let mcpConnected = false;
async function ensureMcpConnected() {
  if (!mcpConnected) {
    await mcpServer.connect(mcpTransport);
    mcpConnected = true;
    console.error('MCP Streamable HTTP transport connected');
  }
}

// MCP endpoint for remote connectors (Claude Desktop "Add custom connector")
app.all('/mcp', async (c) => {
  await ensureMcpConnected();
  return mcpTransport.handleRequest(c.req.raw);
});

// ============================================================================
// REST API (for mcp-client package)
// ============================================================================

// List all available tools
app.get('/tools', (c) => {
  return c.json({ tools: allTools });
});

/**
 * Build server context from session ID
 */
async function buildContext(sessionId: string | null): Promise<ServerContext> {
  let context: ServerContext = {
    callerAddress: '0x0000000000000000000000000000000000000000',
    isAuthenticated: false,
    isRegistered: false,
    sessionId: null,
  };

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session) {
      context = {
        callerAddress: session.walletAddress,
        isAuthenticated: true,
        isRegistered: session.isRegistered,
        sessionId,
      };
    }
  }

  return context;
}

/**
 * Execute a tool by name with given arguments and context
 */
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ServerContext
): Promise<unknown> {
  switch (toolName) {
    // Auth tools
    case 'auth_get_challenge':
      return await getChallengeHandler(args);
    case 'auth_verify':
      return await verifySignatureHandler(args);
    case 'auth_session':
      return await getSessionHandler(args, context);

    // Task tools
    case 'list_tasks':
      return await listTasksTool.handler(args);
    case 'get_task':
      return await getTaskTool.handler(args);
    case 'create_task':
      return await createTaskTool.handler(args, context);
    case 'cancel_task':
      return await cancelTaskTool.handler(args, context);
    case 'submit_work':
      return await submitWorkTool.handler(args, context);
    case 'get_my_submissions':
      return await getMySubmissionsTool.handler(args, context);
    case 'register_agent':
      return await registerAgentTool.handler(args, context);
    case 'update_profile':
      return await updateProfileTool.handler(args, context);

    // Dispute tools
    case 'get_dispute':
      return await getDisputeTool.handler(args);
    case 'list_disputes':
      return await listDisputesTool.handler(args);
    case 'start_dispute':
      return await startDisputeTool.handler(args, context);
    case 'submit_vote':
      return await submitVoteTool.handler(args, context);
    case 'resolve_dispute':
      return await resolveDisputeTool.handler(args);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Tool execution endpoint
app.post('/tools/:toolName', async (c) => {
  const toolName = c.req.param('toolName');

  try {
    // Parse request body
    let body: Record<string, unknown> = {};
    try {
      body = await c.req.json();
    } catch {
      // Empty body is valid for tools with no required args
    }

    // Get session ID from header
    const sessionId = c.req.header('X-Session-Id') || null;

    // Build context from session
    const context = await buildContext(sessionId);

    // Check access control (with on-chain registration refresh for registered tools)
    const accessCheck = await checkAccessWithRegistrationRefresh(toolName, context);
    if (!accessCheck.allowed) {
      // SECURITY: Log access denial with validated IP
      const ip = getClientIp(c);
      logAccessDenied(ip, toolName, accessCheck.reason || 'Unknown', sessionId || undefined);

      return c.json(
        {
          error: 'Access denied',
          code: ERROR_CODES.ACCESS_DENIED,
          reason: accessCheck.reason,
        },
        403
      );
    }

    // If registration was just detected, update the context
    if (accessCheck.registrationUpdated) {
      context.isRegistered = true;
    }

    // Execute the tool
    const result = await executeTool(toolName, body, context);

    return c.json(result);
  } catch (error) {
    // Return 404 for unknown tools, 500 for other errors (sanitized)
    if (isUnknownToolError(error)) {
      const message = error instanceof Error ? error.message : 'Unknown tool';
      return c.json({ error: message, code: ERROR_CODES.UNKNOWN_TOOL }, 404);
    }

    return c.json(toHttpError(error), 500);
  }
});

/**
 * Start the HTTP server
 */
export function startHttpServer(port: number = 3001): ReturnType<typeof Bun.serve> {
  console.error(`Starting HTTP server on port ${port}...`);

  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });

  console.error(`HTTP server listening on http://localhost:${port}`);
  console.error(`  Health: http://localhost:${port}/health`);
  console.error(`  Tools:  http://localhost:${port}/tools`);
  console.error(`  MCP:    http://localhost:${port}/mcp (remote connector)`);
  console.error(`  A2A:    http://localhost:${port}/a2a (Agent-to-Agent protocol)`);
  console.error(`  Agent Card: http://localhost:${port}/.well-known/agent-card.json`);

  return server;
}

export { app };
