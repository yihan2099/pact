/**
 * Cache client implementation with Redis + memory fallback
 *
 * Uses Upstash Redis as primary storage with an in-memory Map
 * as fallback when Redis is unavailable.
 */

import { getRedisClient } from '@clawboy/redis';
import type { ICache, CacheOptions, CacheResult } from './types';
import { tagIndexKey } from './key-builder';
import { TTL_CONFIG } from './ttl-config';

/**
 * In-memory cache entry with expiration
 */
interface MemoryCacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

// In-memory fallback storage
const memoryCache = new Map<string, MemoryCacheEntry<unknown>>();
const memoryTagIndex = new Map<string, Set<string>>();

// Cleanup interval for expired entries (every 5 minutes)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start cleanup interval for in-memory cache
 */
function startCleanupInterval(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache) {
      if (entry.expiresAt < now) {
        // Remove from tag index
        for (const tag of entry.tags) {
          memoryTagIndex.get(tag)?.delete(key);
        }
        memoryCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Cache client implementation
 */
class CacheClient implements ICache {
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();

    if (redis) {
      try {
        const data = await redis.get<T>(key);
        return data ?? null;
      } catch (error) {
        console.warn('Redis get error, falling back to memory:', error);
      }
    }

    // In-memory fallback
    const entry = memoryCache.get(key) as MemoryCacheEntry<T> | undefined;
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      memoryCache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl ?? TTL_CONFIG.DEFAULT;
    const tags = options.tags ?? [];
    const redis = getRedisClient();

    if (redis) {
      try {
        const pipeline = redis.pipeline();

        // Set the value with TTL
        pipeline.set(key, JSON.stringify(value), { ex: ttl });

        // Add to tag indexes
        for (const tag of tags) {
          const tagKey = tagIndexKey(tag);
          pipeline.sadd(tagKey, key);
          pipeline.expire(tagKey, ttl);
        }

        await pipeline.exec();
        return;
      } catch (error) {
        console.warn('Redis set error, falling back to memory:', error);
      }
    }

    // In-memory fallback
    startCleanupInterval();

    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
      tags,
    });

    // Update tag index
    for (const tag of tags) {
      if (!memoryTagIndex.has(tag)) {
        memoryTagIndex.set(tag, new Set());
      }
      memoryTagIndex.get(tag)!.add(key);
    }
  }

  async delete(key: string): Promise<boolean> {
    const redis = getRedisClient();

    if (redis) {
      try {
        const result = await redis.del(key);
        return result > 0;
      } catch (error) {
        console.warn('Redis delete error, falling back to memory:', error);
      }
    }

    // In-memory fallback
    const entry = memoryCache.get(key);
    if (entry) {
      // Remove from tag index
      for (const tag of entry.tags) {
        memoryTagIndex.get(tag)?.delete(key);
      }
      memoryCache.delete(key);
      return true;
    }

    return false;
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const redis = getRedisClient();

    if (redis) {
      try {
        let cursor: string | number = 0;
        let deletedCount = 0;

        do {
          const result: [string, string[]] = await redis.scan(cursor, {
            match: pattern,
            count: 100,
          });
          cursor = result[0];
          const keys = result[1];

          if (keys.length > 0) {
            await redis.del(...keys);
            deletedCount += keys.length;
          }
        } while (cursor !== '0');

        return deletedCount;
      } catch (error) {
        console.warn('Redis deleteByPattern error, falling back to memory:', error);
      }
    }

    // In-memory fallback
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let deletedCount = 0;

    for (const [key, entry] of memoryCache) {
      if (regex.test(key)) {
        // Remove from tag index
        for (const tag of entry.tags) {
          memoryTagIndex.get(tag)?.delete(key);
        }
        memoryCache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async deleteByTag(tag: string): Promise<number> {
    const redis = getRedisClient();

    if (redis) {
      try {
        const tagKey = tagIndexKey(tag);
        const keys = await redis.smembers(tagKey);

        if (keys.length === 0) {
          return 0;
        }

        const pipeline = redis.pipeline();
        for (const key of keys) {
          pipeline.del(key);
        }
        pipeline.del(tagKey);
        await pipeline.exec();

        return keys.length;
      } catch (error) {
        console.warn('Redis deleteByTag error, falling back to memory:', error);
      }
    }

    // In-memory fallback
    const keys = memoryTagIndex.get(tag);
    if (!keys || keys.size === 0) {
      return 0;
    }

    let deletedCount = 0;
    for (const key of keys) {
      const entry = memoryCache.get(key);
      if (entry) {
        // Remove from other tag indexes
        for (const entryTag of entry.tags) {
          if (entryTag !== tag) {
            memoryTagIndex.get(entryTag)?.delete(key);
          }
        }
        memoryCache.delete(key);
        deletedCount++;
      }
    }
    memoryTagIndex.delete(tag);

    return deletedCount;
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    if (keys.length === 0) return result;

    const redis = getRedisClient();

    if (redis) {
      try {
        const values = await redis.mget<(T | null)[]>(...keys);

        for (let i = 0; i < keys.length; i++) {
          const value = values[i];
          if (value !== null) {
            result.set(keys[i], value);
          }
        }

        return result;
      } catch (error) {
        console.warn('Redis getMany error, falling back to memory:', error);
      }
    }

    // In-memory fallback
    const now = Date.now();
    for (const key of keys) {
      const entry = memoryCache.get(key) as MemoryCacheEntry<T> | undefined;
      if (entry && entry.expiresAt >= now) {
        result.set(key, entry.value);
      }
    }

    return result;
  }

  async setMany<T>(
    entries: Array<{ key: string; value: T; options?: CacheOptions }>
  ): Promise<void> {
    if (entries.length === 0) return;

    const redis = getRedisClient();

    if (redis) {
      try {
        const pipeline = redis.pipeline();

        for (const entry of entries) {
          const ttl = entry.options?.ttl ?? TTL_CONFIG.DEFAULT;
          const tags = entry.options?.tags ?? [];

          pipeline.set(entry.key, JSON.stringify(entry.value), { ex: ttl });

          for (const tag of tags) {
            const tagKey = tagIndexKey(tag);
            pipeline.sadd(tagKey, entry.key);
            pipeline.expire(tagKey, ttl);
          }
        }

        await pipeline.exec();
        return;
      } catch (error) {
        console.warn('Redis setMany error, falling back to memory:', error);
      }
    }

    // In-memory fallback
    startCleanupInterval();

    for (const entry of entries) {
      const ttl = entry.options?.ttl ?? TTL_CONFIG.DEFAULT;
      const tags = entry.options?.tags ?? [];

      memoryCache.set(entry.key, {
        value: entry.value,
        expiresAt: Date.now() + ttl * 1000,
        tags,
      });

      for (const tag of tags) {
        if (!memoryTagIndex.has(tag)) {
          memoryTagIndex.set(tag, new Set());
        }
        memoryTagIndex.get(tag)!.add(entry.key);
      }
    }
  }
}

// Singleton cache instance
let cacheInstance: CacheClient | null = null;

/**
 * Get the cache client singleton
 */
export function getCache(): ICache {
  if (!cacheInstance) {
    cacheInstance = new CacheClient();
  }
  return cacheInstance;
}

/**
 * Cache-through helper function
 *
 * Attempts to get from cache first, falls back to fetcher if miss,
 * then caches the result.
 */
export async function cacheThrough<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<CacheResult<T>> {
  const cache = getCache();

  // Check cache unless skipRead is set
  if (!options.skipRead) {
    const cached = await cache.get<T>(key);
    if (cached !== null) {
      return { data: cached, hit: true };
    }
  }

  // Cache miss - fetch data
  const data = await fetcher();

  // Store in cache unless skipWrite is set
  if (!options.skipWrite) {
    await cache.set(key, data, options);
  }

  return { data, hit: false };
}

/**
 * Clear all cache data (primarily for testing)
 */
export function clearAllCache(): void {
  memoryCache.clear();
  memoryTagIndex.clear();
}

/**
 * Get cache statistics (for monitoring)
 */
export async function getCacheStats(): Promise<{
  memoryCacheSize: number;
  storageType: 'redis' | 'memory';
}> {
  const redis = getRedisClient();

  return {
    memoryCacheSize: memoryCache.size,
    storageType: redis ? 'redis' : 'memory',
  };
}
