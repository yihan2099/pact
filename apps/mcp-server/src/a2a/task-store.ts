/**
 * A2A Task Store
 *
 * Manages A2A task lifecycle with Redis storage and in-memory fallback.
 * Follows the same pattern as session-manager.ts.
 */

import { getRedisClient } from '@clawboy/rate-limit';
import type { A2ATask, A2ATaskStatus, A2ATaskOutput, A2ATaskError } from './types';

// Task expiration: 7 days for authenticated sessions
const TASK_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;
const TASK_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

// SECURITY: Reduced TTL for anonymous sessions to prevent task store flooding
// Anonymous tasks expire in 15 minutes instead of 7 days
const ANONYMOUS_TASK_EXPIRATION_MS = 15 * 60 * 1000;
const ANONYMOUS_TASK_EXPIRATION_SECONDS = 15 * 60;

// Redis key prefixes
const TASK_PREFIX = 'a2a:task:';
const SESSION_TASKS_PREFIX = 'a2a:session:';

// In-memory fallback storage
const memoryTaskStore = new Map<string, A2ATask>();
const memorySessionIndex = new Map<string, Set<string>>();

/**
 * Create a new A2A task
 *
 * SECURITY: Anonymous sessions (starting with 'anonymous-') have reduced TTL
 * to prevent task store flooding attacks.
 */
export async function createA2ATask(
  skillId: string,
  input: Record<string, unknown>,
  sessionId: string
): Promise<A2ATask> {
  const taskId = crypto.randomUUID();
  const now = Date.now();

  // SECURITY: Detect anonymous sessions and apply reduced TTL
  const isAnonymous = sessionId.startsWith('anonymous-');
  const expirationSeconds = isAnonymous
    ? ANONYMOUS_TASK_EXPIRATION_SECONDS
    : TASK_EXPIRATION_SECONDS;

  const task: A2ATask = {
    id: taskId,
    status: 'pending',
    skillId,
    input,
    sessionId,
    createdAt: now,
    updatedAt: now,
  };

  const redis = getRedisClient();

  if (redis) {
    try {
      const taskKey = `${TASK_PREFIX}${taskId}`;
      const sessionKey = `${SESSION_TASKS_PREFIX}${sessionId}`;

      // Use pipeline for atomic operations with appropriate TTL
      const pipeline = redis.pipeline();
      pipeline.set(taskKey, JSON.stringify(task), { ex: expirationSeconds });
      pipeline.zadd(sessionKey, { score: now, member: taskId });
      pipeline.expire(sessionKey, expirationSeconds);
      await pipeline.exec();

      return task;
    } catch (error) {
      console.warn('Redis error in createA2ATask, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  memoryTaskStore.set(taskId, task);
  if (!memorySessionIndex.has(sessionId)) {
    memorySessionIndex.set(sessionId, new Set());
  }
  memorySessionIndex.get(sessionId)!.add(taskId);

  return task;
}

/**
 * Get a task by ID
 */
export async function getA2ATask(taskId: string): Promise<A2ATask | null> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const taskKey = `${TASK_PREFIX}${taskId}`;
      const data = await redis.get<A2ATask>(taskKey);
      return data || null;
    } catch (error) {
      console.warn('Redis error in getA2ATask, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  const task = memoryTaskStore.get(taskId);

  if (!task) {
    return null;
  }

  // Check if task is expired (manual check for in-memory)
  // SECURITY: Use reduced TTL for anonymous sessions
  const isAnonymous = task.sessionId.startsWith('anonymous-');
  const expirationMs = isAnonymous ? ANONYMOUS_TASK_EXPIRATION_MS : TASK_EXPIRATION_MS;
  if (Date.now() - task.createdAt > expirationMs) {
    memoryTaskStore.delete(taskId);
    return null;
  }

  return task;
}

/**
 * Update a task's status
 */
export async function updateA2ATaskStatus(
  taskId: string,
  status: A2ATaskStatus,
  output?: A2ATaskOutput,
  error?: A2ATaskError
): Promise<A2ATask | null> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const taskKey = `${TASK_PREFIX}${taskId}`;
      const task = await redis.get<A2ATask>(taskKey);

      if (!task) {
        return null;
      }

      const updatedTask: A2ATask = {
        ...task,
        status,
        updatedAt: Date.now(),
        ...(output && { output }),
        ...(error && { error }),
      };

      // Calculate remaining TTL
      const remainingMs = task.createdAt + TASK_EXPIRATION_MS - Date.now();
      const remainingSeconds = Math.max(1, Math.floor(remainingMs / 1000));

      await redis.set(taskKey, JSON.stringify(updatedTask), { ex: remainingSeconds });
      return updatedTask;
    } catch (err) {
      console.warn('Redis error in updateA2ATaskStatus, falling back to memory:', err);
    }
  }

  // Fallback to in-memory storage
  const task = memoryTaskStore.get(taskId);
  if (!task) {
    return null;
  }

  task.status = status;
  task.updatedAt = Date.now();
  if (output) task.output = output;
  if (error) task.error = error;

  return task;
}

/**
 * List tasks for a session
 */
export async function listA2ATasksBySession(
  sessionId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: A2ATaskStatus;
  } = {}
): Promise<{ tasks: A2ATask[]; total: number }> {
  const { limit = 20, offset = 0, status } = options;
  const redis = getRedisClient();

  if (redis) {
    try {
      const sessionKey = `${SESSION_TASKS_PREFIX}${sessionId}`;

      // Get all task IDs for this session (sorted by creation time, newest first)
      const taskIds = await redis.zrange(sessionKey, 0, -1, { rev: true });

      if (taskIds.length === 0) {
        return { tasks: [], total: 0 };
      }

      // Fetch all tasks
      const pipeline = redis.pipeline();
      for (const id of taskIds) {
        pipeline.get(`${TASK_PREFIX}${id}`);
      }
      const results = await pipeline.exec();

      // Filter and paginate
      let tasks = results
        .map((r) => (r ? (JSON.parse(r as string) as A2ATask) : null))
        .filter((t): t is A2ATask => t !== null);

      if (status) {
        tasks = tasks.filter((t) => t.status === status);
      }

      const total = tasks.length;
      const paginatedTasks = tasks.slice(offset, offset + limit);

      return { tasks: paginatedTasks, total };
    } catch (error) {
      console.warn('Redis error in listA2ATasksBySession, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  const taskIds = memorySessionIndex.get(sessionId);
  if (!taskIds || taskIds.size === 0) {
    return { tasks: [], total: 0 };
  }

  let tasks = Array.from(taskIds)
    .map((id) => memoryTaskStore.get(id))
    .filter((t): t is A2ATask => t !== undefined)
    .sort((a, b) => b.createdAt - a.createdAt); // Newest first

  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }

  const total = tasks.length;
  const paginatedTasks = tasks.slice(offset, offset + limit);

  return { tasks: paginatedTasks, total };
}

/**
 * Cancel a task (if it's pending or working)
 */
export async function cancelA2ATask(taskId: string, sessionId: string): Promise<A2ATask | null> {
  const task = await getA2ATask(taskId);

  if (!task) {
    return null;
  }

  // Verify session ownership
  if (task.sessionId !== sessionId) {
    return null;
  }

  // Can only cancel pending or working tasks
  if (task.status !== 'pending' && task.status !== 'working') {
    return null;
  }

  return updateA2ATaskStatus(taskId, 'cancelled');
}

/**
 * Clean up expired tasks (only needed for in-memory fallback)
 */
export function cleanupExpiredA2ATasks(): number {
  const redis = getRedisClient();

  // Redis TTL handles expiration automatically
  if (redis) {
    return 0;
  }

  const now = Date.now();
  let count = 0;

  for (const [taskId, task] of memoryTaskStore) {
    // SECURITY: Use reduced TTL for anonymous sessions
    const isAnonymous = task.sessionId.startsWith('anonymous-');
    const expirationMs = isAnonymous ? ANONYMOUS_TASK_EXPIRATION_MS : TASK_EXPIRATION_MS;
    if (now - task.createdAt > expirationMs) {
      memorySessionIndex.get(task.sessionId)?.delete(taskId);
      memoryTaskStore.delete(taskId);
      count++;
    }
  }

  return count;
}

/**
 * Get task statistics (for monitoring)
 */
export async function getA2ATaskStats(): Promise<{
  totalTasks: number;
  storageType: 'redis' | 'memory';
}> {
  const redis = getRedisClient();

  if (redis) {
    try {
      let cursor: string | number = 0;
      let totalTasks = 0;

      do {
        const result: [string, string[]] = await redis.scan(cursor, {
          match: `${TASK_PREFIX}*`,
          count: 100,
        });
        cursor = result[0];
        totalTasks += result[1].length;
      } while (cursor !== '0');

      return {
        totalTasks,
        storageType: 'redis',
      };
    } catch (error) {
      console.warn('Redis error in getA2ATaskStats, falling back to memory:', error);
    }
  }

  return {
    totalTasks: memoryTaskStore.size,
    storageType: 'memory',
  };
}

// Run cleanup every 10 minutes (only affects in-memory fallback)
setInterval(cleanupExpiredA2ATasks, 10 * 60 * 1000);
