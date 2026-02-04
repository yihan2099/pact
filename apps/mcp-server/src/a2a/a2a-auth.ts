/**
 * A2A Authentication Middleware
 *
 * Handles Bearer token (sessionId) authentication for A2A requests.
 * Supports Authorization header and X-Session-Id header for compatibility.
 */

import type { Context, Next } from 'hono';
import { getSession } from '../auth/session-manager';
import type { ServerContext } from '../server';

/**
 * Extended Hono context with A2A variables
 */
export interface A2AHonoContext {
  serverContext: ServerContext;
  sessionId: string | null;
}

/**
 * Extract session ID from request headers
 * Priority: Authorization Bearer > X-Session-Id
 */
export function extractSessionId(c: Context): string | null {
  // Check Authorization header first (Bearer token)
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // Fall back to X-Session-Id header for compatibility with existing MCP client
  const sessionIdHeader = c.req.header('X-Session-Id');
  if (sessionIdHeader) {
    return sessionIdHeader;
  }

  return null;
}

/**
 * Build server context from session ID
 */
export async function buildContext(sessionId: string | null): Promise<ServerContext> {
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
 * A2A authentication middleware
 * Extracts session ID and builds context, attaching it to the request
 */
export async function a2aAuthMiddleware(c: Context, next: Next): Promise<Response | void> {
  const sessionId = extractSessionId(c);
  const context = await buildContext(sessionId);

  // Store in Hono context variables
  c.set('serverContext', context);
  c.set('sessionId', sessionId);

  await next();
}

/**
 * Get server context from Hono context
 */
export function getServerContext(c: Context): ServerContext {
  return c.get('serverContext') as ServerContext;
}

/**
 * Get session ID from Hono context
 */
export function getSessionIdFromContext(c: Context): string | null {
  return c.get('sessionId') as string | null;
}

/**
 * Require authentication middleware
 * Returns 401 if not authenticated
 */
export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const context = getServerContext(c);

  if (!context.isAuthenticated) {
    return c.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32002,
          message: 'Authentication required. Use wallet-signature auth flow to get a session.',
        },
      },
      401
    );
  }

  await next();
}
