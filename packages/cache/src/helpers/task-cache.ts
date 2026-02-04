/**
 * Task caching helpers
 *
 * Provides high-level caching functions for task data.
 */

import { cacheThrough, getCache } from '../cache-client';
import { taskKey, taskListKey, type TaskListKeyParams } from '../key-builder';
import { TTL_CONFIG } from '../ttl-config';
import type { CacheOptions, CacheResult } from '../types';

/**
 * Task list response shape (matches typical DB query result)
 */
export interface TaskListData<T> {
  tasks: T[];
  total: number;
}

/**
 * Get cached task list with cache-through pattern
 *
 * @param params Query parameters used for cache key generation
 * @param fetcher Function to fetch data on cache miss
 * @param options Optional cache options
 */
export async function getCachedTaskList<T>(
  params: TaskListKeyParams,
  fetcher: () => Promise<TaskListData<T>>,
  options: CacheOptions = {}
): Promise<CacheResult<TaskListData<T>>> {
  const key = taskListKey(params);

  return cacheThrough(key, fetcher, {
    ttl: TTL_CONFIG.TASK_LIST,
    tags: ['task_list'],
    ...options,
  });
}

/**
 * Get cached single task with cache-through pattern
 *
 * @param taskId The task ID
 * @param fetcher Function to fetch data on cache miss
 * @param options Optional cache options
 */
export async function getCachedTask<T>(
  taskId: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<CacheResult<T>> {
  const key = taskKey(taskId);

  return cacheThrough(key, fetcher, {
    ttl: TTL_CONFIG.TASK_DETAIL,
    tags: ['task', `task:${taskId}`],
    ...options,
  });
}

/**
 * Batch fetch tasks with cache
 *
 * Checks cache first for all IDs, then fetches only missing ones.
 * Useful for resolving N+1 query problems.
 *
 * @param taskIds Array of task IDs to fetch
 * @param batchFetcher Function to fetch multiple tasks by their IDs
 */
export async function getCachedTasksBatch<T>(
  taskIds: string[],
  batchFetcher: (ids: string[]) => Promise<Map<string, T>>
): Promise<{ data: Map<string, T>; hits: number; misses: number }> {
  if (taskIds.length === 0) {
    return { data: new Map(), hits: 0, misses: 0 };
  }

  const cache = getCache();

  // Build cache keys
  const keys = taskIds.map((id) => taskKey(id));

  // Check cache for all keys
  const cached = await cache.getMany<T>(keys);

  // Map cache results back to task IDs
  const result = new Map<string, T>();
  const missingIds: string[] = [];

  for (let i = 0; i < taskIds.length; i++) {
    const cachedValue = cached.get(keys[i]);
    if (cachedValue !== undefined) {
      result.set(taskIds[i], cachedValue);
    } else {
      missingIds.push(taskIds[i]);
    }
  }

  // Fetch missing from database
  if (missingIds.length > 0) {
    const fetched = await batchFetcher(missingIds);

    // Cache and add to result
    const cacheEntries: Array<{ key: string; value: T; options: CacheOptions }> = [];

    for (const [id, task] of fetched) {
      result.set(id, task);
      cacheEntries.push({
        key: taskKey(id),
        value: task,
        options: {
          ttl: TTL_CONFIG.TASK_DETAIL,
          tags: ['task', `task:${id}`],
        },
      });
    }

    await cache.setMany(cacheEntries);
  }

  return {
    data: result,
    hits: taskIds.length - missingIds.length,
    misses: missingIds.length,
  };
}

/**
 * Preload tasks into cache
 *
 * Useful for warming the cache after bulk operations.
 */
export async function preloadTasks<T>(
  tasks: Array<{ id: string; data: T }>
): Promise<void> {
  if (tasks.length === 0) return;

  const cache = getCache();

  const entries = tasks.map((task) => ({
    key: taskKey(task.id),
    value: task.data,
    options: {
      ttl: TTL_CONFIG.TASK_DETAIL,
      tags: ['task', `task:${task.id}`],
    },
  }));

  await cache.setMany(entries);
}
