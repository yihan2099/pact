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
import { checkAccess } from './auth/access-control';
import { listTasksTool } from './tools/task/list-tasks';
import { getTaskTool } from './tools/task/get-task';
import { createTaskTool } from './tools/task/create-task';
import { cancelTaskTool } from './tools/task/cancel-task';
import { submitWorkTool } from './tools/agent/submit-work';
import { getMySubmissionsTool } from './tools/agent/get-my-submissions';
import {
  getChallengeHandler,
  verifySignatureHandler,
  getSessionHandler,
} from './tools/auth';
import { allTools } from './tools';

const app = new Hono();

// Enable CORS for client calls
app.use('/*', cors());

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

    // Check access control
    const accessCheck = checkAccess(toolName, context);
    if (!accessCheck.allowed) {
      return c.json(
        {
          error: 'Access denied',
          reason: accessCheck.reason,
        },
        403
      );
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
