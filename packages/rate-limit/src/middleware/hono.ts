/**
 * Hono middleware for MCP server rate limiting
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import { getOperationType, getMcpLimiter, getGlobalLimiter } from '../config/mcp-config';

/**
 * SECURITY: Whether to trust proxy headers for client IP detection.
 * Only enable if behind a trusted reverse proxy that overwrites these headers.
 * When false, uses a fallback identifier that may group multiple users.
 */
const TRUST_PROXY_HEADERS = process.env.TRUST_PROXY_HEADERS === 'true';

/**
 * SECURITY: Simple IPv4/IPv6 validation pattern to prevent injection attacks
 */
const IP_PATTERN = /^(?:(?:\d{1,3}\.){3}\d{1,3}|(?:[a-fA-F0-9:]+:+)+[a-fA-F0-9]+)$/;

/**
 * Get client IP from Hono context
 *
 * SECURITY: x-forwarded-for and x-real-ip headers can be spoofed by attackers
 * unless behind a trusted reverse proxy that overwrites these headers.
 * Only trusts these headers if TRUST_PROXY_HEADERS=true is set.
 */
function getClientIp(c: Context): string {
  if (TRUST_PROXY_HEADERS) {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
      const clientIp = forwarded.split(',')[0].trim();
      // Validate IP format to prevent injection
      if (IP_PATTERN.test(clientIp)) {
        return clientIp;
      }
    }

    const realIp = c.req.header('x-real-ip');
    if (realIp && IP_PATTERN.test(realIp)) {
      return realIp;
    }
  }

  // Fallback: Use a consistent identifier when IP cannot be determined
  // This prevents rate limit bypass but may group multiple users
  return 'unknown-client';
}

/**
 * Get the rate limit identifier (session ID or IP)
 */
function getIdentifier(c: Context): string {
  const sessionId = c.req.header('X-Session-Id');
  if (sessionId) {
    return `session:${sessionId}`;
  }
  return `ip:${getClientIp(c)}`;
}

/**
 * Create rate limit middleware for the MCP server
 *
 * Applies two levels of rate limiting:
 * 1. Global rate limit per IP (100/min)
 * 2. Operation-specific rate limit per session/IP
 *
 * SECURITY: Fails closed if rate limiting is unavailable to prevent abuse.
 */
export function createMcpRateLimitMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const identifier = getIdentifier(c);

    // Extract tool name from path (e.g., /tools/list_tasks -> list_tasks)
    const path = c.req.path;
    const toolMatch = path.match(/^\/tools\/([^/]+)$/);
    const toolName = toolMatch?.[1];

    try {
      // 1. Check global rate limit (by IP)
      const globalLimiter = getGlobalLimiter();
      if (globalLimiter) {
        const globalResult = await globalLimiter.limit(`ip:${ip}`);
        if (!globalResult.success) {
          return c.json(
            {
              error: 'Too many requests',
              message: 'Global rate limit exceeded. Please try again later.',
              retryAfter: Math.ceil((globalResult.reset - Date.now()) / 1000),
            },
            429
          );
        }
      }

      // 2. Check operation-specific rate limit (by session/IP)
      if (toolName) {
        const operationType = getOperationType(toolName);
        const opLimiter = getMcpLimiter(operationType);

        if (opLimiter) {
          const opResult = await opLimiter.limit(identifier);

          // Add rate limit headers
          c.res.headers.set('X-RateLimit-Limit', opResult.limit.toString());
          c.res.headers.set('X-RateLimit-Remaining', opResult.remaining.toString());
          c.res.headers.set('X-RateLimit-Reset', opResult.reset.toString());

          if (!opResult.success) {
            return c.json(
              {
                error: 'Too many requests',
                message: `Rate limit exceeded for ${operationType} operations. Please try again later.`,
                retryAfter: Math.ceil((opResult.reset - Date.now()) / 1000),
              },
              429
            );
          }
        }
      }
    } catch (error) {
      // SECURITY: Fail closed - reject request if rate limiter is unavailable
      // This prevents abuse when Redis is down or misconfigured
      console.error('Rate limiter error, rejecting request for safety:', error);
      return c.json(
        {
          error: 'Service temporarily unavailable',
          message: 'Rate limiting service is unavailable. Please try again later.',
        },
        503
      );
    }

    await next();
  };
}
