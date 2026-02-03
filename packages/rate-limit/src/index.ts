/**
 * @clawboy/rate-limit
 *
 * Shared rate limiting package using Upstash Redis
 */

// Client
export { getRedisClient, isRateLimitingEnabled } from './client';

// Configs
export {
  WEB_RATE_LIMITS,
  createWaitlistLimiter,
} from './config/web-config';

export {
  MCP_RATE_LIMITS,
  TOOL_OPERATION_MAP,
  getOperationType,
  getMcpLimiter,
  getGlobalLimiter,
  type OperationType,
} from './config/mcp-config';

// Middleware
export { createMcpRateLimitMiddleware } from './middleware/hono';
