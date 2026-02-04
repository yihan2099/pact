/**
 * Rate limit configuration for the MCP server
 */

import { Ratelimit } from '@upstash/ratelimit';
import { getRedisClient } from '../client';

/**
 * Operation types for rate limiting
 */
export type OperationType = 'global' | 'read' | 'write' | 'auth';

/**
 * Rate limit configuration for each operation type
 */
export const MCP_RATE_LIMITS = {
  global: {
    limit: 100,
    window: '1 m' as const,
    prefix: 'mcp:global',
  },
  read: {
    limit: 100,
    window: '1 m' as const,
    prefix: 'mcp:read',
  },
  write: {
    limit: 10,
    window: '1 m' as const,
    prefix: 'mcp:write',
  },
  auth: {
    limit: 20,
    window: '1 m' as const,
    prefix: 'mcp:auth',
  },
} as const;

/**
 * Map of tool names to their operation type
 *
 * SECURITY: All tools should be explicitly mapped to prevent abuse.
 * Default is 'read' but write operations should be explicitly listed
 * to ensure proper rate limiting of expensive operations.
 */
export const TOOL_OPERATION_MAP: Record<string, OperationType> = {
  // Auth tools
  auth_get_challenge: 'auth',
  auth_verify: 'auth',
  auth_session: 'auth',

  // Read tools (public queries)
  list_tasks: 'read',
  get_task: 'read',
  get_my_submissions: 'read',
  get_capabilities: 'read',
  get_workflow_guide: 'read',
  get_supported_tokens: 'read',
  get_dispute: 'read',
  list_disputes: 'read',
  get_reputation: 'read',
  get_feedback_history: 'read',

  // Write tools (expensive operations - strictly rate limited)
  create_task: 'write',
  cancel_task: 'write',
  submit_work: 'write',
  register_agent: 'write',
  update_profile: 'write',
  start_dispute: 'write',
  submit_vote: 'write',
  resolve_dispute: 'write',
};

/**
 * Get the operation type for a tool
 */
export function getOperationType(toolName: string): OperationType {
  return TOOL_OPERATION_MAP[toolName] || 'read';
}

/**
 * Rate limiter cache to avoid recreating on every request
 */
const limiterCache = new Map<string, Ratelimit>();

/**
 * Create or get a cached rate limiter for an operation type
 */
export function getMcpLimiter(operationType: OperationType): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  const cacheKey = operationType;
  const cached = limiterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const config = MCP_RATE_LIMITS[operationType];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    prefix: config.prefix,
    analytics: true,
  });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

/**
 * Create or get a cached global rate limiter
 */
export function getGlobalLimiter(): Ratelimit | null {
  return getMcpLimiter('global');
}
