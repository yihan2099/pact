/**
 * Cache invalidation helpers
 *
 * Provides domain-specific invalidation functions to ensure
 * cache consistency when data changes.
 */

import { getCache } from './cache-client';
import {
  taskPattern,
  taskListPattern,
  taskKey,
  agentPattern,
  agentByAddressKey,
  submissionPattern,
  submissionKey,
  submissionListKey,
  statsPattern,
  disputeKey,
  disputeListKey,
} from './key-builder';

/**
 * Invalidate all task-related caches
 * @param taskId Optional specific task ID to invalidate
 */
export async function invalidateTaskCaches(taskId?: string): Promise<number> {
  const cache = getCache();
  let count = 0;

  if (taskId) {
    // Invalidate specific task
    const deleted = await cache.delete(taskKey(taskId));
    if (deleted) count++;
  } else {
    // Invalidate all tasks
    count += await cache.deleteByPattern(taskPattern());
  }

  // Always invalidate task lists since they aggregate task data
  count += await cache.deleteByPattern(taskListPattern());

  // Invalidate stats since they include task counts
  count += await cache.deleteByPattern(statsPattern());

  return count;
}

/**
 * Invalidate all agent-related caches
 * @param address Optional specific agent address to invalidate
 */
export async function invalidateAgentCaches(address?: string): Promise<number> {
  const cache = getCache();
  let count = 0;

  if (address) {
    // Invalidate specific agent
    const deleted = await cache.delete(agentByAddressKey(address));
    if (deleted) count++;
  } else {
    // Invalidate all agents
    count += await cache.deleteByPattern(agentPattern());
  }

  // Invalidate stats since they include agent counts
  count += await cache.deleteByPattern(statsPattern());

  return count;
}

/**
 * Invalidate submission-related caches
 * @param taskId Optional task ID to scope invalidation
 * @param agentAddress Optional agent address to scope invalidation
 */
export async function invalidateSubmissionCaches(
  taskId?: string,
  agentAddress?: string
): Promise<number> {
  const cache = getCache();
  let count = 0;

  if (taskId && agentAddress) {
    // Invalidate specific submission
    const deleted = await cache.delete(submissionKey(taskId, agentAddress));
    if (deleted) count++;
    // Also invalidate submissions list for this task
    count += await cache.deleteByPattern(submissionListKey({ taskId }) + '*');
    // And for this agent
    count += await cache.deleteByPattern(submissionListKey({ agentAddress }) + '*');
  } else if (taskId) {
    // Invalidate all submissions for a task
    count += await cache.deleteByPattern(submissionListKey({ taskId }) + '*');
  } else if (agentAddress) {
    // Invalidate all submissions for an agent
    count += await cache.deleteByPattern(submissionListKey({ agentAddress }) + '*');
  } else {
    // Invalidate all submissions
    count += await cache.deleteByPattern(submissionPattern());
  }

  // Invalidate related task caches (submission count changes)
  if (taskId) {
    count += await cache.deleteByPattern(taskKey(taskId));
    count += await cache.deleteByPattern(taskListPattern());
  }

  return count;
}

/**
 * Invalidate dispute-related caches
 * @param disputeId Optional specific dispute ID to invalidate
 * @param taskId Optional task ID to scope invalidation
 */
export async function invalidateDisputeCaches(
  disputeId?: string,
  taskId?: string
): Promise<number> {
  const cache = getCache();
  let count = 0;

  if (disputeId) {
    // Invalidate specific dispute
    const deleted = await cache.delete(disputeKey(disputeId));
    if (deleted) count++;
  }

  if (taskId) {
    // Invalidate dispute lists for this task
    count += await cache.deleteByPattern(disputeListKey({ taskId }) + '*');
  } else if (!disputeId) {
    // Invalidate all disputes
    count += await cache.deleteByPattern(disputeKey('') + '*');
  }

  // Invalidate dispute lists
  count += await cache.deleteByPattern(disputeListKey({}) + '*');

  return count;
}

/**
 * Invalidate statistics caches
 */
export async function invalidateStatsCaches(): Promise<number> {
  const cache = getCache();
  return cache.deleteByPattern(statsPattern());
}

/**
 * Invalidate all caches
 * Use sparingly - primarily for debugging or critical situations
 */
export async function invalidateAllCaches(): Promise<number> {
  const cache = getCache();
  let count = 0;

  count += await cache.deleteByPattern(taskPattern());
  count += await cache.deleteByPattern(taskListPattern());
  count += await cache.deleteByPattern(agentPattern());
  count += await cache.deleteByPattern(submissionPattern());
  count += await cache.deleteByPattern(statsPattern());

  return count;
}
