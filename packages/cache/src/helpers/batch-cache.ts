/**
 * Generic batch caching utilities
 *
 * Provides tools for solving N+1 query problems by batching
 * cache lookups and database fetches.
 */

import { getCache } from '../cache-client';
import { TTL_CONFIG } from '../ttl-config';
import type { CacheOptions } from '../types';

/**
 * Batch fetch result with cache statistics
 */
export interface BatchFetchResult<K, V> {
  /** Map of key to value */
  data: Map<K, V>;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses (fetched from source) */
  misses: number;
}

/**
 * Generic batch fetch with cache
 *
 * This is the core utility for solving N+1 problems. It:
 * 1. Checks cache for all keys at once (single mget)
 * 2. Fetches only missing items from the source
 * 3. Caches the newly fetched items
 *
 * @param ids Array of identifiers to fetch
 * @param keyBuilder Function to build cache key from an ID
 * @param batchFetcher Function to fetch multiple items by their IDs
 * @param options Cache options (TTL, tags)
 */
export async function batchFetchWithCache<K, V>(
  ids: K[],
  keyBuilder: (id: K) => string,
  batchFetcher: (ids: K[]) => Promise<Map<K, V>>,
  options: CacheOptions = {}
): Promise<BatchFetchResult<K, V>> {
  if (ids.length === 0) {
    return { data: new Map(), hits: 0, misses: 0 };
  }

  const cache = getCache();
  const ttl = options.ttl ?? TTL_CONFIG.DEFAULT;
  const tags = options.tags ?? [];

  // Build cache keys
  const keyToId = new Map<string, K>();
  const keys: string[] = [];

  for (const id of ids) {
    const key = keyBuilder(id);
    keys.push(key);
    keyToId.set(key, id);
  }

  // Batch get from cache
  const cached = await cache.getMany<V>(keys);

  // Separate hits and misses
  const result = new Map<K, V>();
  const missingIds: K[] = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const id = ids[i];
    const cachedValue = cached.get(key);

    if (cachedValue !== undefined) {
      result.set(id, cachedValue);
    } else {
      missingIds.push(id);
    }
  }

  // Fetch missing items
  if (missingIds.length > 0) {
    const fetched = await batchFetcher(missingIds);

    // Prepare cache entries
    const cacheEntries: Array<{ key: string; value: V; options: CacheOptions }> = [];

    for (const [id, value] of fetched) {
      result.set(id, value);
      cacheEntries.push({
        key: keyBuilder(id),
        value,
        options: { ttl, tags },
      });
    }

    // Batch set in cache
    if (cacheEntries.length > 0) {
      await cache.setMany(cacheEntries);
    }
  }

  return {
    data: result,
    hits: ids.length - missingIds.length,
    misses: missingIds.length,
  };
}

/**
 * Preload multiple items into cache
 *
 * Useful for warming cache after bulk operations or
 * proactively caching related data.
 *
 * @param items Array of items with their IDs
 * @param keyBuilder Function to build cache key from an ID
 * @param options Cache options (TTL, tags)
 */
export async function preloadBatch<K, V>(
  items: Array<{ id: K; value: V }>,
  keyBuilder: (id: K) => string,
  options: CacheOptions = {}
): Promise<void> {
  if (items.length === 0) return;

  const cache = getCache();
  const ttl = options.ttl ?? TTL_CONFIG.DEFAULT;
  const tags = options.tags ?? [];

  const entries = items.map((item) => ({
    key: keyBuilder(item.id),
    value: item.value,
    options: { ttl, tags },
  }));

  await cache.setMany(entries);
}

/**
 * Get multiple items from cache only (no fetching)
 *
 * Useful when you want to check what's already cached
 * without triggering fetches.
 *
 * @param ids Array of identifiers to check
 * @param keyBuilder Function to build cache key from an ID
 */
export async function getCachedOnly<K, V>(
  ids: K[],
  keyBuilder: (id: K) => string
): Promise<Map<K, V>> {
  if (ids.length === 0) {
    return new Map();
  }

  const cache = getCache();
  const keys = ids.map((id) => keyBuilder(id));
  const cached = await cache.getMany<V>(keys);

  // Map back to original IDs
  const result = new Map<K, V>();
  for (let i = 0; i < ids.length; i++) {
    const cachedValue = cached.get(keys[i]);
    if (cachedValue !== undefined) {
      result.set(ids[i], cachedValue);
    }
  }

  return result;
}

/**
 * Delete multiple items from cache
 *
 * @param ids Array of identifiers to delete
 * @param keyBuilder Function to build cache key from an ID
 * @returns Number of items deleted
 */
export async function deleteBatch<K>(
  ids: K[],
  keyBuilder: (id: K) => string
): Promise<number> {
  if (ids.length === 0) return 0;

  const cache = getCache();
  let deleted = 0;

  for (const id of ids) {
    const success = await cache.delete(keyBuilder(id));
    if (success) deleted++;
  }

  return deleted;
}
