/**
 * Core cache types and interfaces
 */

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /** Time-to-live in seconds */
  ttl?: number;
  /** Tags for grouped invalidation */
  tags?: string[];
  /** Skip reading from cache (force fetch) */
  skipRead?: boolean;
  /** Skip writing to cache */
  skipWrite?: boolean;
}

/**
 * Result of a cache-through operation
 */
export interface CacheResult<T> {
  /** The cached or fetched data */
  data: T;
  /** Whether data was served from cache */
  hit: boolean;
}

/**
 * Cache client interface
 */
export interface ICache {
  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Delete a single key from cache
   */
  delete(key: string): Promise<boolean>;

  /**
   * Delete all keys matching a pattern
   * @returns Number of keys deleted
   */
  deleteByPattern(pattern: string): Promise<number>;

  /**
   * Delete all keys associated with a tag
   * @returns Number of keys deleted
   */
  deleteByTag(tag: string): Promise<number>;

  /**
   * Get multiple values from cache
   */
  getMany<T>(keys: string[]): Promise<Map<string, T>>;

  /**
   * Set multiple values in cache
   */
  setMany<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void>;
}

/**
 * Supported data types for caching
 */
export type CacheDataType =
  | 'task'
  | 'task_list'
  | 'agent'
  | 'submission'
  | 'dispute'
  | 'statistics';
