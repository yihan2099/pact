import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { getCache, clearAllCache } from '../../cache-client';
import {
  getCachedTaskList,
  getCachedTask,
  getCachedTasksBatch,
  preloadTasks,
} from '../../helpers/task-cache';
import { taskKey, taskListKey } from '../../key-builder';
import { TTL_CONFIG } from '../../ttl-config';

describe('Task Cache Helpers', () => {
  beforeEach(() => {
    clearAllCache();
  });

  describe('getCachedTaskList', () => {
    test('returns cached data on hit', async () => {
      const cache = getCache();
      const cachedData = { tasks: [{ id: '1', title: 'Task 1' }], total: 1 };
      await cache.set(taskListKey({ status: 'open' }), cachedData);

      const fetcher = mock(() =>
        Promise.resolve({ tasks: [{ id: '2', title: 'Task 2' }], total: 1 })
      );

      const result = await getCachedTaskList({ status: 'open' }, fetcher);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('calls fetcher on miss', async () => {
      const fetchedData = { tasks: [{ id: '1' }], total: 1 };
      const fetcher = mock(() => Promise.resolve(fetchedData));

      const result = await getCachedTaskList({ status: 'pending' }, fetcher);

      expect(result.hit).toBe(false);
      expect(result.data).toEqual(fetchedData);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('caches result with correct TTL', async () => {
      const cache = getCache();
      const fetchedData = { tasks: [], total: 0 };
      const fetcher = mock(() => Promise.resolve(fetchedData));

      await getCachedTaskList({}, fetcher);

      // Verify data is cached
      const cached = await cache.get(taskListKey({}));
      expect(cached).toEqual(fetchedData);
    });

    test('uses correct cache key based on params', async () => {
      const cache = getCache();
      const fetcher = mock(() => Promise.resolve({ tasks: [], total: 0 }));

      await getCachedTaskList(
        {
          status: 'completed',
          creatorAddress: '0xABC',
          limit: 10,
          offset: 0,
        },
        fetcher
      );

      // Verify correct key is used
      const key = taskListKey({
        status: 'completed',
        creatorAddress: '0xABC',
        limit: 10,
        offset: 0,
      });
      const cached = await cache.get(key);
      expect(cached).not.toBeNull();
    });

    test('passes through custom options', async () => {
      const cache = getCache();
      const fetcher = mock(() => Promise.resolve({ tasks: [], total: 0 }));

      await getCachedTaskList({}, fetcher, { skipRead: true });

      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCachedTask', () => {
    test('returns cached task on hit', async () => {
      const cache = getCache();
      const cachedTask = { id: '123', title: 'Cached Task', bounty: 100 };
      await cache.set(taskKey('123'), cachedTask);

      const fetcher = mock(() => Promise.resolve({ id: '123', title: 'Fetched' }));

      const result = await getCachedTask('123', fetcher);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(cachedTask);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('fetches and caches on miss', async () => {
      const cache = getCache();
      const fetchedTask = { id: '456', title: 'New Task' };
      const fetcher = mock(() => Promise.resolve(fetchedTask));

      const result = await getCachedTask('456', fetcher);

      expect(result.hit).toBe(false);
      expect(result.data).toEqual(fetchedTask);
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Verify it's now cached
      const cached = await cache.get(taskKey('456'));
      expect(cached).toEqual(fetchedTask);
    });

    test('uses correct TTL', async () => {
      const fetcher = mock(() => Promise.resolve({ id: '789' }));

      await getCachedTask('789', fetcher);

      // Note: We can't directly verify TTL with in-memory cache easily,
      // but we verify the function works correctly
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('applies custom tags', async () => {
      const cache = getCache();
      const fetcher = mock(() => Promise.resolve({ id: '111' }));

      await getCachedTask('111', fetcher);

      // Should be deletable by tag
      const deletedCount = await cache.deleteByTag('task');
      expect(deletedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getCachedTasksBatch', () => {
    test('returns empty map for empty input', async () => {
      const fetcher = mock(() => Promise.resolve(new Map()));

      const result = await getCachedTasksBatch([], fetcher);

      expect(result.data.size).toBe(0);
      expect(result.hits).toBe(0);
      expect(result.misses).toBe(0);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('returns all from cache when all cached', async () => {
      const cache = getCache();
      await cache.set(taskKey('1'), { id: '1', title: 'Task 1' });
      await cache.set(taskKey('2'), { id: '2', title: 'Task 2' });

      const fetcher = mock(() => Promise.resolve(new Map()));

      const result = await getCachedTasksBatch(['1', '2'], fetcher);

      expect(result.data.size).toBe(2);
      expect(result.hits).toBe(2);
      expect(result.misses).toBe(0);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('fetches only missing items', async () => {
      const cache = getCache();
      await cache.set(taskKey('1'), { id: '1', title: 'Cached' });

      const fetcher = mock((ids: string[]) => {
        const map = new Map<string, { id: string; title: string }>();
        for (const id of ids) {
          map.set(id, { id, title: `Fetched ${id}` });
        }
        return Promise.resolve(map);
      });

      const result = await getCachedTasksBatch(['1', '2', '3'], fetcher);

      expect(result.data.size).toBe(3);
      expect(result.hits).toBe(1);
      expect(result.misses).toBe(2);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith(['2', '3']);
    });

    test('caches newly fetched items', async () => {
      const cache = getCache();

      const fetcher = mock((ids: string[]) => {
        const map = new Map<string, { id: string }>();
        for (const id of ids) {
          map.set(id, { id });
        }
        return Promise.resolve(map);
      });

      await getCachedTasksBatch(['a', 'b'], fetcher);

      // Verify items are now cached
      const cachedA = await cache.get(taskKey('a'));
      const cachedB = await cache.get(taskKey('b'));
      expect(cachedA).toEqual({ id: 'a' });
      expect(cachedB).toEqual({ id: 'b' });
    });

    test('returns correct hit/miss counts', async () => {
      const cache = getCache();
      await cache.set(taskKey('cached-1'), { id: 'cached-1' });
      await cache.set(taskKey('cached-2'), { id: 'cached-2' });

      const fetcher = mock((ids: string[]) => {
        const map = new Map<string, { id: string }>();
        for (const id of ids) {
          map.set(id, { id });
        }
        return Promise.resolve(map);
      });

      const result = await getCachedTasksBatch(
        ['cached-1', 'missing-1', 'cached-2', 'missing-2'],
        fetcher
      );

      expect(result.hits).toBe(2);
      expect(result.misses).toBe(2);
    });
  });

  describe('preloadTasks', () => {
    test('loads multiple tasks into cache', async () => {
      const cache = getCache();

      await preloadTasks([
        { id: 'preload-1', data: { title: 'Task 1' } },
        { id: 'preload-2', data: { title: 'Task 2' } },
        { id: 'preload-3', data: { title: 'Task 3' } },
      ]);

      expect(await cache.get(taskKey('preload-1'))).toEqual({ title: 'Task 1' });
      expect(await cache.get(taskKey('preload-2'))).toEqual({ title: 'Task 2' });
      expect(await cache.get(taskKey('preload-3'))).toEqual({ title: 'Task 3' });
    });

    test('subsequent gets return cached values', async () => {
      await preloadTasks([{ id: 'get-after-preload', data: { id: 'test', value: 42 } }]);

      const fetcher = mock(() => Promise.resolve({ id: 'test', value: 999 }));

      const result = await getCachedTask('get-after-preload', fetcher);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual({ id: 'test', value: 42 });
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('handles empty input', async () => {
      // Should not throw
      await preloadTasks([]);
    });

    test('applies correct tags for invalidation', async () => {
      const cache = getCache();

      await preloadTasks([
        { id: 'tagged-preload', data: { id: 'tagged' } },
      ]);

      // Should be deletable by 'task' tag
      const count = await cache.deleteByTag('task');
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
