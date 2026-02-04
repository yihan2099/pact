/**
 * A2A Router
 *
 * Hono router for A2A protocol endpoints:
 * - GET /.well-known/agent-card.json - Agent Card discovery
 * - POST /a2a - JSON-RPC endpoint for A2A methods
 */

import { Hono } from 'hono';
import { generateAgentCard } from './agent-card';
import { a2aAuthMiddleware, getServerContext } from './a2a-auth';
import {
  handleMessageSend,
  handleMessageStream,
  handleTasksGet,
  handleTasksList,
  handleTasksCancel,
} from './handlers';
import type { A2AJsonRpcRequest, A2AJsonRpcResponse } from './types';
import { A2A_ERROR_CODES, createErrorResponse } from './types';
import { logSecurityEvent } from '../services/security-logger';

// Create A2A router
const a2aRouter = new Hono();

// ============================================================================
// Agent Card Discovery Endpoint
// ============================================================================

/**
 * GET /.well-known/agent-card.json
 * Returns the A2A Agent Card for discovery
 */
a2aRouter.get('/.well-known/agent-card.json', (c) => {
  const agentCard = generateAgentCard();

  // Set cache headers (cache for 5 minutes)
  c.header('Cache-Control', 'public, max-age=300');

  return c.json(agentCard);
});

// ============================================================================
// A2A JSON-RPC Endpoint
// ============================================================================

// Apply auth middleware to /a2a endpoint
a2aRouter.use('/a2a', a2aAuthMiddleware);

// Request logging middleware for A2A
a2aRouter.use('/a2a', async (c, next) => {
  const start = Date.now();
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  const context = getServerContext(c);

  logSecurityEvent({
    type: status >= 400 ? 'access_denied' : 'auth_challenge_requested',
    timestamp: new Date().toISOString(),
    ip,
    toolName: 'a2a',
    sessionId: context.sessionId || undefined,
    metadata: {
      method: c.req.method,
      status,
      duration,
      endpoint: 'a2a',
    },
  });
});

/**
 * POST /a2a
 * JSON-RPC 2.0 endpoint for A2A protocol methods
 */
a2aRouter.post('/a2a', async (c) => {
  // Parse JSON-RPC request
  let request: A2AJsonRpcRequest;
  try {
    request = await c.req.json();
  } catch {
    return c.json(createErrorResponse(null, A2A_ERROR_CODES.PARSE_ERROR, 'Invalid JSON'), 400);
  }

  // Validate JSON-RPC 2.0 structure
  if (request.jsonrpc !== '2.0') {
    return c.json(
      createErrorResponse(
        request.id ?? null,
        A2A_ERROR_CODES.INVALID_REQUEST,
        'Invalid JSON-RPC version'
      ),
      400
    );
  }

  if (typeof request.method !== 'string') {
    return c.json(
      createErrorResponse(
        request.id ?? null,
        A2A_ERROR_CODES.INVALID_REQUEST,
        'Missing or invalid method'
      ),
      400
    );
  }

  if (request.id === undefined || request.id === null) {
    return c.json(
      createErrorResponse(null, A2A_ERROR_CODES.INVALID_REQUEST, 'Missing request id'),
      400
    );
  }

  const { id, method, params } = request;

  // Route to appropriate handler
  let response: A2AJsonRpcResponse | Response;

  switch (method) {
    case 'message/send':
      response = await handleMessageSend(c, id, params as any);
      break;

    case 'message/stream':
      // message/stream returns an SSE Response directly
      return handleMessageStream(c, id, params as any);

    case 'tasks/get':
      response = await handleTasksGet(c, id, params as any);
      break;

    case 'tasks/list':
      response = await handleTasksList(c, id, params as any);
      break;

    case 'tasks/cancel':
      response = await handleTasksCancel(c, id, params as any);
      break;

    default:
      response = createErrorResponse(
        id,
        A2A_ERROR_CODES.METHOD_NOT_FOUND,
        `Method not found: ${method}`
      );
  }

  // If handler returned a Response (like SSE), return it directly
  if (response instanceof Response) {
    return response;
  }

  // Return JSON-RPC response with appropriate status code
  const statusCode = response.error
    ? response.error.code === A2A_ERROR_CODES.ACCESS_DENIED
      ? 403
      : 400
    : 200;
  return c.json(response, statusCode);
});

export { a2aRouter };
