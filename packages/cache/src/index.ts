/**
 * @clawboy/cache
 *
 * Caching layer for the Clawboy platform.
 * Provides Redis-first caching with in-memory fallback.
 *
 * Usage:
 * ```typescript
 * import { getCache, cacheThrough } from '@clawboy/cache';
 * import { getCachedTaskList } from '@clawboy/cache/helpers';
 *
 * // Direct cache access
 * const cache = getCache();
 * await cache.set('key', value, { ttl: 60 });
 * const data = await cache.get('key');
 *
 * // Cache-through pattern
 * const { data, hit } = await cacheThrough('key', fetcher, { ttl: 60 });
 *
 * // Domain-specific helpers
 * const result = await getCachedTaskList(params, fetcher);
 * ```
 */

// Core cache client
export { getCache, cacheThrough, clearAllCache, getCacheStats } from './cache-client';

// Types
export type { CacheOptions, CacheResult, ICache, CacheDataType } from './types';

// TTL configuration
export { TTL_CONFIG, getTTL, type TTLKey } from './ttl-config';

// Key builders
export {
  KEY_PREFIX,
  taskKey,
  taskListKey,
  agentKey,
  agentByAddressKey,
  agentListKey,
  submissionKey,
  submissionListKey,
  disputeKey,
  disputeListKey,
  platformStatsKey,
  topAgentsKey,
  tagIndexKey,
  taskPattern,
  taskListPattern,
  agentPattern,
  submissionPattern,
  statsPattern,
  type TaskListKeyParams,
  type AgentListKeyParams,
  type SubmissionListKeyParams,
  type DisputeListKeyParams,
} from './key-builder';

// Invalidation helpers
export {
  invalidateTaskCaches,
  invalidateAgentCaches,
  invalidateSubmissionCaches,
  invalidateDisputeCaches,
  invalidateStatsCaches,
  invalidateAllCaches,
} from './invalidation';
