import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { getCache, clearAllCache } from '../../cache-client';
import {
  batchFetchWithCache,
  preloadBatch,
  getCachedOnly,
  deleteBatch,
} from '../../helpers/batch-cache';
import { TTL_CONFIG } from '../../ttl-config';

describe('Batch Cache Utilities', () => {
  beforeEach(() => {
    clearAllCache();
  });

  // Simple key builder for tests
  const keyBuilder = (id: string) => `test:${id}`;

  describe('batchFetchWithCache', () => {
    test('returns empty map for empty input', async () => {
      const fetcher = mock(() => Promise.resolve(new Map()));

      const result = await batchFetchWithCache([], keyBuilder, fetcher);

      expect(result.data.size).toBe(0);
      expect(result.hits).toBe(0);
      expect(result.misses).toBe(0);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('returns all cached when all in cache', async () => {
      const cache = getCache();
      await cache.set(keyBuilder('1'), { id: '1', value: 'cached-1' });
      await cache.set(keyBuilder('2'), { id: '2', value: 'cached-2' });
      await cache.set(keyBuilder('3'), { id: '3', value: 'cached-3' });

      const fetcher = mock(() => Promise.resolve(new Map()));

      const result = await batchFetchWithCache(['1', '2', '3'], keyBuilder, fetcher);

      expect(result.data.size).toBe(3);
      expect(result.hits).toBe(3);
      expect(result.misses).toBe(0);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('fetches all when none cached', async () => {
      const fetcher = mock((ids: string[]) => {
        const map = new Map<string, { id: string }>();
        for (const id of ids) {
          map.set(id, { id });
        }
        return Promise.resolve(map);
      });

      const result = await batchFetchWithCache(['a', 'b', 'c'], keyBuilder, fetcher);

      expect(result.data.size).toBe(3);
      expect(result.hits).toBe(0);
      expect(result.misses).toBe(3);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith(['a', 'b', 'c']);
    });

    test('partial cache - fetches only missing', async () => {
      const cache = getCache();
      await cache.set(keyBuilder('cached-1'), { id: 'cached-1', source: 'cache' });
      await cache.set(keyBuilder('cached-2'), { id: 'cached-2', source: 'cache' });

      const fetcher = mock((ids: string[]) => {
        const map = new Map<string, { id: string; source: string }>();
        for (const id of ids) {
          map.set(id, { id, source: 'fetched' });
        }
        return Promise.resolve(map);
      });

      const result = await batchFetchWithCache(
        ['cached-1', 'missing-1', 'cached-2', 'missing-2'],
        keyBuilder,
        fetcher
      );

      expect(result.data.size).toBe(4);
      expect(result.hits).toBe(2);
      expect(result.misses).toBe(2);
      expect(fetcher).toHaveBeenCalledWith(['missing-1', 'missing-2']);

      // Verify sources
      expect(result.data.get('cached-1')?.source).toBe('cache');
      expect(result.data.get('missing-1')?.source).toBe('fetched');
    });

    test('caches fetched items', async () => {
      const cache = getCache();

      const fetcher = mock((ids: string[]) => {
        const map = new Map<string, { id: string; data: number }>();
        for (const id of ids) {
          map.set(id, { id, data: 42 });
        }
        return Promise.resolve(map);
      });

      await batchFetchWithCache(['new-1', 'new-2'], keyBuilder, fetcher);

      // Verify items are now cached
      const cached1 = await cache.get(keyBuilder('new-1'));
      const cached2 = await cache.get(keyBuilder('new-2'));
      expect(cached1).toEqual({ id: 'new-1', data: 42 });
      expect(cached2).toEqual({ id: 'new-2', data: 42 });
    });

    test('applies correct TTL', async () => {
      const fetcher = mock((ids: string[]) => {
        const map = new Map<string, { id: string }>();
        for (const id of ids) {
          map.set(id, { id });
        }
        return Promise.resolve(map);
      });

      await batchFetchWithCache(['ttl-test'], keyBuilder, fetcher, {
        ttl: 1, // 1 second
      });

      // Value should exist now
      const cache = getCache();
      expect(await cache.get(keyBuilder('ttl-test'))).not.toBeNull();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Value should be expired
      expect(await cache.get(keyBuilder('ttl-test'))).toBeNull();
    });

    test('applies tags correctly', async () => {
      const cache = getCache();

      const fetcher = mock((ids: string[]) => {
        const map = new Map<string, { id: string }>();
        for (const id of ids) {
          map.set(id, { id });
        }
        return Promise.resolve(map);
      });

      await batchFetchWithCache(['tagged-1', 'tagged-2'], keyBuilder, fetcher, {
        tags: ['batch-test-tag'],
      });

      // Should be deletable by tag
      const count = await cache.deleteByTag('batch-test-tag');
      expect(count).toBe(2);
    });

    test('uses default TTL when not specified', async () => {
      const cache = getCache();

      const fetcher = mock((ids: string[]) => {
        const map = new Map<string, { id: string }>();
        for (const id of ids) {
          map.set(id, { id });
        }
        return Promise.resolve(map);
      });

      await batchFetchWithCache(['default-ttl'], keyBuilder, fetcher);

      // Value should be cached
      expect(await cache.get(keyBuilder('default-ttl'))).toEqual({ id: 'default-ttl' });
    });
  });

  describe('preloadBatch', () => {
    test('loads items into cache', async () => {
      const cache = getCache();

      await preloadBatch(
        [
          { id: 'preload-1', value: { name: 'Item 1' } },
          { id: 'preload-2', value: { name: 'Item 2' } },
          { id: 'preload-3', value: { name: 'Item 3' } },
        ],
        keyBuilder
      );

      expect(await cache.get(keyBuilder('preload-1'))).toEqual({ name: 'Item 1' });
      expect(await cache.get(keyBuilder('preload-2'))).toEqual({ name: 'Item 2' });
      expect(await cache.get(keyBuilder('preload-3'))).toEqual({ name: 'Item 3' });
    });

    test('applies options to all items', async () => {
      const cache = getCache();

      await preloadBatch(
        [
          { id: 'opt-1', value: { data: 1 } },
          { id: 'opt-2', value: { data: 2 } },
        ],
        keyBuilder,
        { tags: ['preload-tag'] }
      );

      // All should be deletable by tag
      const count = await cache.deleteByTag('preload-tag');
      expect(count).toBe(2);
    });

    test('handles empty input', async () => {
      // Should not throw
      await preloadBatch([], keyBuilder);
    });

    test('preloaded items can be retrieved by batchFetchWithCache', async () => {
      await preloadBatch(
        [
          { id: 'pre-a', value: { preloaded: true } },
          { id: 'pre-b', value: { preloaded: true } },
        ],
        keyBuilder
      );

      const fetcher = mock(() => Promise.resolve(new Map()));

      const result = await batchFetchWithCache(['pre-a', 'pre-b'], keyBuilder, fetcher);

      expect(result.hits).toBe(2);
      expect(result.misses).toBe(0);
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  describe('getCachedOnly', () => {
    test('returns only cached items', async () => {
      const cache = getCache();
      await cache.set(keyBuilder('exists-1'), { id: 'exists-1' });
      await cache.set(keyBuilder('exists-2'), { id: 'exists-2' });

      const result = await getCachedOnly(
        ['exists-1', 'missing', 'exists-2'],
        keyBuilder
      );

      expect(result.size).toBe(2);
      expect(result.get('exists-1')).toEqual({ id: 'exists-1' });
      expect(result.get('exists-2')).toEqual({ id: 'exists-2' });
      expect(result.has('missing')).toBe(false);
    });

    test('does not fetch missing items', async () => {
      // Just checking cache behavior - no fetcher involved
      const result = await getCachedOnly(['nonexistent-1', 'nonexistent-2'], keyBuilder);

      expect(result.size).toBe(0);
    });

    test('returns empty map for empty input', async () => {
      const result = await getCachedOnly([], keyBuilder);
      expect(result.size).toBe(0);
    });

    test('handles all items being in cache', async () => {
      const cache = getCache();
      await cache.set(keyBuilder('all-1'), { value: 1 });
      await cache.set(keyBuilder('all-2'), { value: 2 });
      await cache.set(keyBuilder('all-3'), { value: 3 });

      const result = await getCachedOnly(['all-1', 'all-2', 'all-3'], keyBuilder);

      expect(result.size).toBe(3);
    });

    test('handles all items being missing from cache', async () => {
      const result = await getCachedOnly(['miss-1', 'miss-2', 'miss-3'], keyBuilder);

      expect(result.size).toBe(0);
    });
  });

  describe('deleteBatch', () => {
    test('deletes multiple items', async () => {
      const cache = getCache();
      await cache.set(keyBuilder('del-1'), { id: 1 });
      await cache.set(keyBuilder('del-2'), { id: 2 });
      await cache.set(keyBuilder('del-3'), { id: 3 });
      await cache.set(keyBuilder('keep'), { id: 4 });

      const count = await deleteBatch(['del-1', 'del-2', 'del-3'], keyBuilder);

      expect(count).toBe(3);
      expect(await cache.get(keyBuilder('del-1'))).toBeNull();
      expect(await cache.get(keyBuilder('del-2'))).toBeNull();
      expect(await cache.get(keyBuilder('del-3'))).toBeNull();
      expect(await cache.get(keyBuilder('keep'))).toEqual({ id: 4 });
    });

    test('returns count of deleted items', async () => {
      const cache = getCache();
      await cache.set(keyBuilder('count-1'), { id: 1 });
      await cache.set(keyBuilder('count-2'), { id: 2 });

      const count = await deleteBatch(
        ['count-1', 'count-2', 'nonexistent'],
        keyBuilder
      );

      expect(count).toBe(2);
    });

    test('returns 0 for empty input', async () => {
      const count = await deleteBatch([], keyBuilder);
      expect(count).toBe(0);
    });

    test('returns 0 when no items exist', async () => {
      const count = await deleteBatch(
        ['nonexistent-1', 'nonexistent-2'],
        keyBuilder
      );
      expect(count).toBe(0);
    });

    test('handles mixed existing and non-existing items', async () => {
      const cache = getCache();
      await cache.set(keyBuilder('mixed-1'), { id: 1 });
      await cache.set(keyBuilder('mixed-3'), { id: 3 });

      const count = await deleteBatch(
        ['mixed-1', 'mixed-2', 'mixed-3', 'mixed-4'],
        keyBuilder
      );

      expect(count).toBe(2);
    });
  });
});
