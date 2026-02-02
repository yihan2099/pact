/**
 * HTTP Server for Porter Network MCP
 *
 * Exposes MCP tools over HTTP for remote clients (like the mcp-client package)
 * while the stdio transport handles local MCP connections.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMcpRateLimitMiddleware } from '@porternetwork/rate-limit/middleware/hono';
import type { ServerContext } from './server';
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
import {
  getChallengeHandler,
  verifySignatureHandler,
  getSessionHandler,
} from './tools/auth';
import { allTools } from './tools';
import { logAccessDenied, logSecurityEvent } from './services/security-logger';

const app = new Hono();

// SECURITY: Configure CORS with allowed origins from environment
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['*']; // Default to all for development

app.use('/*', cors({
  origin: (origin) => {
    // Allow requests with no origin (same-origin, curl, etc.)
    if (!origin) return '*';

    // If wildcard is allowed, permit all origins
    if (allowedOrigins.includes('*')) return origin;

    // Check if origin is in allowlist
    if (allowedOrigins.includes(origin)) return origin;

    // Reject unknown origins by returning null
    return null;
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Session-Id'],
  maxAge: 86400, // Cache preflight for 24 hours
}));

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

// SECURITY: Request logging middleware
app.use('/tools/*', async (c, next) => {
  const start = Date.now();
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown';
  const toolName = c.req.path.replace('/tools/', '');
  const sessionId = c.req.header('X-Session-Id');

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Log request (structured for log aggregation)
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
    },
  });
});

// Rate limiting middleware for tool endpoints
app.use('/tools/*', createMcpRateLimitMiddleware());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'porter-mcp-server',
    timestamp: new Date().toISOString(),
  });
});

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
      return await getSessionHandler(args);

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
      // SECURITY: Log access denial
      const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
        || c.req.header('x-real-ip')
        || 'unknown';
      logAccessDenied(ip, toolName, accessCheck.reason || 'Unknown', sessionId || undefined);

      return c.json(
        {
          error: 'Access denied',
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
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Return 404 for unknown tools, 500 for other errors
    const status = message.startsWith('Unknown tool:') ? 404 : 500;

    return c.json({ error: message }, status);
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

  return server;
}

export { app };
