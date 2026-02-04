import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { getCache, cacheThrough, clearAllCache, getCacheStats } from '../cache-client';

describe('Cache Client (In-Memory Fallback)', () => {
  beforeEach(() => {
    // Reset state between tests
    clearAllCache();
  });

  describe('getCache', () => {
    test('returns singleton instance', () => {
      const cache1 = getCache();
      const cache2 = getCache();
      expect(cache1).toBe(cache2);
    });

    test('returns an object implementing ICache interface', () => {
      const cache = getCache();
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
      expect(typeof cache.delete).toBe('function');
      expect(typeof cache.deleteByPattern).toBe('function');
      expect(typeof cache.deleteByTag).toBe('function');
      expect(typeof cache.getMany).toBe('function');
      expect(typeof cache.setMany).toBe('function');
    });
  });

  describe('ICache.get/set', () => {
    test('returns null for non-existent key', async () => {
      const cache = getCache();
      const result = await cache.get('nonexistent-key');
      expect(result).toBeNull();
    });

    test('stores and retrieves value', async () => {
      const cache = getCache();
      const testValue = { name: 'test', count: 42 };

      await cache.set('test-key', testValue);
      const result = await cache.get('test-key');

      expect(result).toEqual(testValue);
    });

    test('stores and retrieves string value', async () => {
      const cache = getCache();
      await cache.set('string-key', 'hello world');
      const result = await cache.get<string>('string-key');
      expect(result).toBe('hello world');
    });

    test('stores and retrieves array value', async () => {
      const cache = getCache();
      const testArray = [1, 2, 3, 'four', { five: 5 }];
      await cache.set('array-key', testArray);
      const result = await cache.get('array-key');
      expect(result).toEqual(testArray);
    });

    test('respects TTL expiration', async () => {
      const cache = getCache();
      await cache.set('expiring-key', 'value', { ttl: 1 }); // 1 second TTL

      // Value should be present immediately
      const immediate = await cache.get('expiring-key');
      expect(immediate).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Value should be gone after TTL
      const expired = await cache.get('expiring-key');
      expect(expired).toBeNull();
    });

    test('uses default TTL when not specified', async () => {
      const cache = getCache();
      await cache.set('default-ttl-key', 'value');

      // Value should be present
      const result = await cache.get('default-ttl-key');
      expect(result).toBe('value');
    });

    test('handles complex nested objects', async () => {
      const cache = getCache();
      const complexObject = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, { nested: true }],
              string: 'deep value',
            },
          },
          date: '2024-01-01',
        },
        metadata: {
          tags: ['tag1', 'tag2'],
        },
      };

      await cache.set('complex-key', complexObject);
      const result = await cache.get('complex-key');
      expect(result).toEqual(complexObject);
    });
  });

  describe('ICache.delete', () => {
    test('returns true when key existed', async () => {
      const cache = getCache();
      await cache.set('delete-test', 'value');

      const result = await cache.delete('delete-test');
      expect(result).toBe(true);
    });

    test('returns false when key did not exist', async () => {
      const cache = getCache();
      const result = await cache.delete('nonexistent-key');
      expect(result).toBe(false);
    });

    test('removes key from cache', async () => {
      const cache = getCache();
      await cache.set('to-delete', 'value');

      // Verify it exists
      expect(await cache.get('to-delete')).toBe('value');

      // Delete it
      await cache.delete('to-delete');

      // Verify it's gone
      expect(await cache.get('to-delete')).toBeNull();
    });

    test('removes key from tag index when deleted', async () => {
      const cache = getCache();
      await cache.set('tagged-key', 'value', { tags: ['test-tag'] });

      await cache.delete('tagged-key');

      // Key should be gone
      expect(await cache.get('tagged-key')).toBeNull();
    });
  });

  describe('ICache.deleteByPattern', () => {
    test('deletes matching keys', async () => {
      const cache = getCache();
      await cache.set('task:1', 'value1');
      await cache.set('task:2', 'value2');
      await cache.set('task:3', 'value3');
      await cache.set('agent:1', 'other');

      const deletedCount = await cache.deleteByPattern('task:*');

      expect(deletedCount).toBe(3);
      expect(await cache.get('task:1')).toBeNull();
      expect(await cache.get('task:2')).toBeNull();
      expect(await cache.get('task:3')).toBeNull();
      expect(await cache.get('agent:1')).toBe('other');
    });

    test('returns count of deleted keys', async () => {
      const cache = getCache();
      await cache.set('prefix:a', 'value');
      await cache.set('prefix:b', 'value');

      const count = await cache.deleteByPattern('prefix:*');
      expect(count).toBe(2);
    });

    test('returns 0 when no keys match', async () => {
      const cache = getCache();
      await cache.set('other:1', 'value');

      const count = await cache.deleteByPattern('nonexistent:*');
      expect(count).toBe(0);
    });

    test('handles complex wildcard patterns', async () => {
      const cache = getCache();
      await cache.set('tasks:s:open', 'value1');
      await cache.set('tasks:s:closed', 'value2');
      await cache.set('tasks:c:0xabc', 'value3');
      await cache.set('task:123', 'value4');

      const count = await cache.deleteByPattern('tasks:*');
      expect(count).toBe(3);
      expect(await cache.get('task:123')).toBe('value4');
    });
  });

  describe('ICache.deleteByTag', () => {
    test('deletes all keys with tag', async () => {
      const cache = getCache();
      await cache.set('key1', 'value1', { tags: ['group-a'] });
      await cache.set('key2', 'value2', { tags: ['group-a'] });
      await cache.set('key3', 'value3', { tags: ['group-b'] });

      const count = await cache.deleteByTag('group-a');

      expect(count).toBe(2);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBe('value3');
    });

    test('returns count of deleted keys', async () => {
      const cache = getCache();
      await cache.set('tagged1', 'value', { tags: ['my-tag'] });
      await cache.set('tagged2', 'value', { tags: ['my-tag'] });
      await cache.set('tagged3', 'value', { tags: ['my-tag'] });

      const count = await cache.deleteByTag('my-tag');
      expect(count).toBe(3);
    });

    test('returns 0 when tag has no keys', async () => {
      const cache = getCache();
      const count = await cache.deleteByTag('nonexistent-tag');
      expect(count).toBe(0);
    });

    test('removes keys from multiple tags', async () => {
      const cache = getCache();
      await cache.set('multi-tag-key', 'value', { tags: ['tag-a', 'tag-b'] });
      await cache.set('only-tag-b', 'other', { tags: ['tag-b'] });

      // Delete by tag-a
      await cache.deleteByTag('tag-a');

      // multi-tag-key should be gone
      expect(await cache.get('multi-tag-key')).toBeNull();
      // only-tag-b should still exist
      expect(await cache.get('only-tag-b')).toBe('other');
    });
  });

  describe('ICache.getMany/setMany', () => {
    test('gets multiple values in one call', async () => {
      const cache = getCache();
      await cache.set('batch-1', 'value1');
      await cache.set('batch-2', 'value2');
      await cache.set('batch-3', 'value3');

      const result = await cache.getMany<string>(['batch-1', 'batch-2', 'batch-3']);

      expect(result.size).toBe(3);
      expect(result.get('batch-1')).toBe('value1');
      expect(result.get('batch-2')).toBe('value2');
      expect(result.get('batch-3')).toBe('value3');
    });

    test('returns only existing keys', async () => {
      const cache = getCache();
      await cache.set('exists-1', 'value1');
      await cache.set('exists-2', 'value2');

      const result = await cache.getMany<string>([
        'exists-1',
        'missing-1',
        'exists-2',
        'missing-2',
      ]);

      expect(result.size).toBe(2);
      expect(result.get('exists-1')).toBe('value1');
      expect(result.get('exists-2')).toBe('value2');
      expect(result.has('missing-1')).toBe(false);
      expect(result.has('missing-2')).toBe(false);
    });

    test('returns empty map for empty input', async () => {
      const cache = getCache();
      const result = await cache.getMany<string>([]);
      expect(result.size).toBe(0);
    });

    test('sets multiple values with individual TTLs', async () => {
      const cache = getCache();

      await cache.setMany([
        { key: 'many-1', value: 'value1', options: { ttl: 3600 } },
        { key: 'many-2', value: 'value2', options: { ttl: 7200 } },
        { key: 'many-3', value: 'value3' },
      ]);

      expect(await cache.get('many-1')).toBe('value1');
      expect(await cache.get('many-2')).toBe('value2');
      expect(await cache.get('many-3')).toBe('value3');
    });

    test('setMany handles empty input', async () => {
      const cache = getCache();
      // Should not throw
      await cache.setMany([]);
    });

    test('setMany applies tags correctly', async () => {
      const cache = getCache();

      await cache.setMany([
        { key: 'tagged-many-1', value: 'v1', options: { tags: ['batch-tag'] } },
        { key: 'tagged-many-2', value: 'v2', options: { tags: ['batch-tag'] } },
      ]);

      // Both should be deletable by tag
      const count = await cache.deleteByTag('batch-tag');
      expect(count).toBe(2);
    });
  });

  describe('cacheThrough', () => {
    test('returns cached value on hit (hit: true)', async () => {
      const cache = getCache();
      await cache.set('through-key', 'cached-value');

      const fetcher = mock(() => Promise.resolve('fetched-value'));

      const result = await cacheThrough('through-key', fetcher);

      expect(result.data).toBe('cached-value');
      expect(result.hit).toBe(true);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('calls fetcher on miss (hit: false)', async () => {
      const fetcher = mock(() => Promise.resolve('fetched-value'));

      const result = await cacheThrough('missing-key', fetcher);

      expect(result.data).toBe('fetched-value');
      expect(result.hit).toBe(false);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('caches fetcher result', async () => {
      const cache = getCache();
      const fetcher = mock(() => Promise.resolve('new-value'));

      // First call - cache miss
      await cacheThrough('cache-result-key', fetcher);

      // Verify it's now cached
      const cached = await cache.get('cache-result-key');
      expect(cached).toBe('new-value');
    });

    test('respects skipRead option', async () => {
      const cache = getCache();
      await cache.set('skip-read-key', 'old-value');

      const fetcher = mock(() => Promise.resolve('new-value'));

      const result = await cacheThrough('skip-read-key', fetcher, { skipRead: true });

      expect(result.data).toBe('new-value');
      expect(result.hit).toBe(false);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('respects skipWrite option', async () => {
      const cache = getCache();
      const fetcher = mock(() => Promise.resolve('fetched-value'));

      await cacheThrough('skip-write-key', fetcher, { skipWrite: true });

      // Value should not be cached
      const cached = await cache.get('skip-write-key');
      expect(cached).toBeNull();
    });

    test('applies TTL and tags options', async () => {
      const cache = getCache();
      const fetcher = mock(() => Promise.resolve({ id: 1, name: 'test' }));

      await cacheThrough('options-key', fetcher, {
        ttl: 60,
        tags: ['test-tag'],
      });

      // Value should be cached
      const cached = await cache.get('options-key');
      expect(cached).toEqual({ id: 1, name: 'test' });

      // Should be deletable by tag
      const count = await cache.deleteByTag('test-tag');
      expect(count).toBe(1);
    });
  });

  describe('clearAllCache', () => {
    test('clears all cached values', async () => {
      const cache = getCache();
      await cache.set('clear-1', 'value1');
      await cache.set('clear-2', 'value2');
      await cache.set('clear-3', 'value3');

      clearAllCache();

      expect(await cache.get('clear-1')).toBeNull();
      expect(await cache.get('clear-2')).toBeNull();
      expect(await cache.get('clear-3')).toBeNull();
    });

    test('clears tag indexes', async () => {
      const cache = getCache();
      await cache.set('tagged-clear', 'value', { tags: ['clear-tag'] });

      clearAllCache();

      // After clearing, deleteByTag should find no keys
      const count = await cache.deleteByTag('clear-tag');
      expect(count).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    test('returns memory cache size', async () => {
      const cache = getCache();
      await cache.set('stats-1', 'value');
      await cache.set('stats-2', 'value');

      const stats = await getCacheStats();

      expect(stats.memoryCacheSize).toBe(2);
    });

    test('returns storage type as memory when Redis unavailable', async () => {
      const stats = await getCacheStats();
      expect(stats.storageType).toBe('memory');
    });

    test('reports zero size after clear', async () => {
      const cache = getCache();
      await cache.set('before-clear', 'value');

      clearAllCache();

      const stats = await getCacheStats();
      expect(stats.memoryCacheSize).toBe(0);
    });
  });
});
