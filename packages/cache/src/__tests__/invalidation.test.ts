import { describe, test, expect, beforeEach } from 'bun:test';
import { getCache, clearAllCache } from '../cache-client';
import {
  invalidateTaskCaches,
  invalidateAgentCaches,
  invalidateSubmissionCaches,
  invalidateDisputeCaches,
  invalidateStatsCaches,
  invalidateAllCaches,
} from '../invalidation';
import {
  taskKey,
  taskListKey,
  agentByAddressKey,
  submissionKey,
  submissionListKey,
  disputeKey,
  disputeListKey,
  platformStatsKey,
  topAgentsKey,
} from '../key-builder';

describe('Cache Invalidation', () => {
  beforeEach(() => {
    clearAllCache();
  });

  describe('invalidateTaskCaches', () => {
    test('invalidates specific task by ID', async () => {
      const cache = getCache();
      await cache.set(taskKey('123'), { id: '123', title: 'Test' });
      await cache.set(taskKey('456'), { id: '456', title: 'Other' });

      const count = await invalidateTaskCaches('123');

      expect(count).toBeGreaterThanOrEqual(1);
      expect(await cache.get(taskKey('123'))).toBeNull();
    });

    test('invalidates all tasks when no ID provided', async () => {
      const cache = getCache();
      await cache.set(taskKey('1'), { id: '1' });
      await cache.set(taskKey('2'), { id: '2' });
      await cache.set(taskKey('3'), { id: '3' });

      await invalidateTaskCaches();

      expect(await cache.get(taskKey('1'))).toBeNull();
      expect(await cache.get(taskKey('2'))).toBeNull();
      expect(await cache.get(taskKey('3'))).toBeNull();
    });

    test('also invalidates task lists', async () => {
      const cache = getCache();
      await cache.set(taskListKey({ status: 'open' }), { tasks: [], total: 0 });
      await cache.set(taskListKey({ status: 'completed' }), { tasks: [], total: 0 });

      await invalidateTaskCaches('123');

      expect(await cache.get(taskListKey({ status: 'open' }))).toBeNull();
      expect(await cache.get(taskListKey({ status: 'completed' }))).toBeNull();
    });

    test('also invalidates stats', async () => {
      const cache = getCache();
      await cache.set(platformStatsKey(), { totalTasks: 100 });
      await cache.set(topAgentsKey(10), { agents: [] });

      await invalidateTaskCaches();

      expect(await cache.get(platformStatsKey())).toBeNull();
      expect(await cache.get(topAgentsKey(10))).toBeNull();
    });
  });

  describe('invalidateAgentCaches', () => {
    test('invalidates specific agent by address', async () => {
      const cache = getCache();
      await cache.set(agentByAddressKey('0xABC'), { address: '0xabc' });
      await cache.set(agentByAddressKey('0xDEF'), { address: '0xdef' });

      const count = await invalidateAgentCaches('0xABC');

      expect(count).toBeGreaterThanOrEqual(1);
      expect(await cache.get(agentByAddressKey('0xABC'))).toBeNull();
    });

    test('normalizes address to lowercase', async () => {
      const cache = getCache();
      // Set with lowercase (as the key builder would do)
      await cache.set(agentByAddressKey('0xabc'), { address: '0xabc' });

      // Invalidate with uppercase
      await invalidateAgentCaches('0xABC');

      expect(await cache.get(agentByAddressKey('0xabc'))).toBeNull();
    });

    test('invalidates all agents when no address provided', async () => {
      const cache = getCache();
      await cache.set(agentByAddressKey('0xaaa'), { address: '0xaaa' });
      await cache.set(agentByAddressKey('0xbbb'), { address: '0xbbb' });

      await invalidateAgentCaches();

      expect(await cache.get(agentByAddressKey('0xaaa'))).toBeNull();
      expect(await cache.get(agentByAddressKey('0xbbb'))).toBeNull();
    });

    test('also invalidates stats', async () => {
      const cache = getCache();
      await cache.set(platformStatsKey(), { totalAgents: 50 });

      await invalidateAgentCaches('0xabc');

      expect(await cache.get(platformStatsKey())).toBeNull();
    });
  });

  describe('invalidateSubmissionCaches', () => {
    test('invalidates specific submission by task ID and agent address', async () => {
      const cache = getCache();
      await cache.set(submissionKey('task-1', '0xabc'), { content: 'submission' });

      const count = await invalidateSubmissionCaches('task-1', '0xabc');

      expect(count).toBeGreaterThanOrEqual(1);
      expect(await cache.get(submissionKey('task-1', '0xabc'))).toBeNull();
    });

    test('invalidates submissions list for task when taskId provided', async () => {
      const cache = getCache();
      await cache.set(submissionListKey({ taskId: 'task-1' }), { submissions: [] });
      await cache.set(submissionListKey({ taskId: 'task-1', limit: 10 }), {
        submissions: [],
      });

      await invalidateSubmissionCaches('task-1');

      expect(await cache.get(submissionListKey({ taskId: 'task-1' }))).toBeNull();
    });

    test('invalidates submissions list for agent when agentAddress provided', async () => {
      const cache = getCache();
      await cache.set(submissionListKey({ agentAddress: '0xabc' }), { submissions: [] });

      await invalidateSubmissionCaches(undefined, '0xabc');

      expect(await cache.get(submissionListKey({ agentAddress: '0xabc' }))).toBeNull();
    });

    test('invalidates related task cache when taskId provided', async () => {
      const cache = getCache();
      await cache.set(taskKey('task-1'), { id: 'task-1' });
      await cache.set(taskListKey(), { tasks: [] });

      await invalidateSubmissionCaches('task-1', '0xabc');

      // Task-related caches should be invalidated
      expect(await cache.get(taskListKey())).toBeNull();
    });

    test('invalidates all submissions when no params provided', async () => {
      const cache = getCache();
      await cache.set(submissionKey('t1', '0xa'), { id: 1 });
      await cache.set(submissionKey('t2', '0xb'), { id: 2 });

      await invalidateSubmissionCaches();

      expect(await cache.get(submissionKey('t1', '0xa'))).toBeNull();
      expect(await cache.get(submissionKey('t2', '0xb'))).toBeNull();
    });
  });

  describe('invalidateDisputeCaches', () => {
    test('invalidates specific dispute by ID', async () => {
      const cache = getCache();
      await cache.set(disputeKey('dispute-1'), { id: 'dispute-1' });
      await cache.set(disputeKey('dispute-2'), { id: 'dispute-2' });

      await invalidateDisputeCaches('dispute-1');

      expect(await cache.get(disputeKey('dispute-1'))).toBeNull();
      // dispute-2 may or may not be invalidated depending on implementation
    });

    test('invalidates dispute lists for task when taskId provided', async () => {
      const cache = getCache();
      await cache.set(disputeListKey({ taskId: 'task-1' }), { disputes: [] });

      await invalidateDisputeCaches(undefined, 'task-1');

      expect(await cache.get(disputeListKey({ taskId: 'task-1' }))).toBeNull();
    });

    test('invalidates all disputes when no params provided', async () => {
      const cache = getCache();
      await cache.set(disputeKey('d1'), { id: 'd1' });
      await cache.set(disputeListKey(), { disputes: [] });

      await invalidateDisputeCaches();

      expect(await cache.get(disputeListKey())).toBeNull();
    });
  });

  describe('invalidateStatsCaches', () => {
    test('invalidates all stats keys', async () => {
      const cache = getCache();
      await cache.set(platformStatsKey(), { totalTasks: 100 });
      await cache.set(topAgentsKey(10), { agents: [] });
      await cache.set(topAgentsKey(25), { agents: [] });

      const count = await invalidateStatsCaches();

      expect(count).toBe(3);
      expect(await cache.get(platformStatsKey())).toBeNull();
      expect(await cache.get(topAgentsKey(10))).toBeNull();
      expect(await cache.get(topAgentsKey(25))).toBeNull();
    });

    test('returns 0 when no stats cached', async () => {
      const count = await invalidateStatsCaches();
      expect(count).toBe(0);
    });
  });

  describe('invalidateAllCaches', () => {
    test('invalidates all cache types', async () => {
      const cache = getCache();

      // Set various cache entries
      await cache.set(taskKey('1'), { id: '1' });
      await cache.set(taskListKey(), { tasks: [] });
      await cache.set(agentByAddressKey('0xabc'), { address: '0xabc' });
      await cache.set(submissionKey('t1', '0xa'), { id: 1 });
      await cache.set(platformStatsKey(), { total: 0 });

      const count = await invalidateAllCaches();

      expect(count).toBeGreaterThanOrEqual(5);
      expect(await cache.get(taskKey('1'))).toBeNull();
      expect(await cache.get(taskListKey())).toBeNull();
      expect(await cache.get(agentByAddressKey('0xabc'))).toBeNull();
      expect(await cache.get(submissionKey('t1', '0xa'))).toBeNull();
      expect(await cache.get(platformStatsKey())).toBeNull();
    });

    test('returns 0 when cache is empty', async () => {
      const count = await invalidateAllCaches();
      expect(count).toBe(0);
    });
  });
});
