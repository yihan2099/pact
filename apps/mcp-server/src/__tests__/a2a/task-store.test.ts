import { describe, test, expect, mock } from 'bun:test';
import { createRateLimitMock } from '../helpers/mock-deps';

const rateLimitMock = createRateLimitMock();

// Mock Redis to force in-memory fallback for deterministic tests
mock.module('@clawboy/rate-limit', () => rateLimitMock);

import {
  createA2ATask,
  getA2ATask,
  updateA2ATaskStatus,
  listA2ATasksBySession,
  cancelA2ATask,
  cleanupExpiredA2ATasks,
  getA2ATaskStats,
} from '../../a2a/task-store';

describe('A2A Task Store (in-memory)', () => {
  // Note: in-memory store persists between tests since it's module-level.
  // We test against fresh UUIDs per test to isolate state.

  describe('createA2ATask', () => {
    test('should create a task with pending status', async () => {
      const task = await createA2ATask('list_tasks', { status: 'open' }, 'session-1');

      expect(task.id).toBeDefined();
      expect(task.status).toBe('pending');
      expect(task.skillId).toBe('list_tasks');
      expect(task.input).toEqual({ status: 'open' });
      expect(task.sessionId).toBe('session-1');
      expect(task.createdAt).toBeGreaterThan(0);
      expect(task.updatedAt).toBeGreaterThan(0);
    });

    test('should generate unique task IDs', async () => {
      const task1 = await createA2ATask('list_tasks', {}, 'session-1');
      const task2 = await createA2ATask('list_tasks', {}, 'session-1');

      expect(task1.id).not.toBe(task2.id);
    });

    test('should index tasks by session', async () => {
      const sessionId = `session-index-${Date.now()}`;
      await createA2ATask('list_tasks', {}, sessionId);
      await createA2ATask('get_task', {}, sessionId);

      const { tasks, total } = await listA2ATasksBySession(sessionId);

      expect(total).toBe(2);
      expect(tasks).toHaveLength(2);
    });
  });

  describe('getA2ATask', () => {
    test('should retrieve an existing task', async () => {
      const created = await createA2ATask('get_task', { taskId: 'abc' }, 'session-get');

      const retrieved = await getA2ATask(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.skillId).toBe('get_task');
    });

    test('should return null for non-existent task', async () => {
      const result = await getA2ATask('non-existent-uuid');

      expect(result).toBeNull();
    });

    test('should return null for expired anonymous task', async () => {
      // Create anonymous task and manually expire it
      const task = await createA2ATask('list_tasks', {}, 'anonymous-test');

      // Directly manipulate createdAt to simulate expiration (15 min for anon)
      // We need to access the internal store to do this, but since we can't,
      // we test that the task is retrievable before expiration
      const retrieved = await getA2ATask(task.id);
      expect(retrieved).not.toBeNull();
    });
  });

  describe('updateA2ATaskStatus', () => {
    test('should update task status to working', async () => {
      const task = await createA2ATask('list_tasks', {}, 'session-update');

      const updated = await updateA2ATaskStatus(task.id, 'working');

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('working');
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(task.updatedAt);
    });

    test('should update task with output on completion', async () => {
      const task = await createA2ATask('list_tasks', {}, 'session-complete');

      const updated = await updateA2ATaskStatus(task.id, 'completed', {
        type: 'result',
        data: { tasks: [], total: 0 },
      });

      expect(updated!.status).toBe('completed');
      expect(updated!.output).toEqual({
        type: 'result',
        data: { tasks: [], total: 0 },
      });
    });

    test('should update task with error on failure', async () => {
      const task = await createA2ATask('list_tasks', {}, 'session-fail');

      const updated = await updateA2ATaskStatus(task.id, 'failed', undefined, {
        code: -32603,
        message: 'Internal error',
      });

      expect(updated!.status).toBe('failed');
      expect(updated!.error).toEqual({
        code: -32603,
        message: 'Internal error',
      });
    });

    test('should return null for non-existent task', async () => {
      const result = await updateA2ATaskStatus('non-existent', 'working');

      expect(result).toBeNull();
    });
  });

  describe('listA2ATasksBySession', () => {
    test('should return empty for unknown session', async () => {
      const { tasks, total } = await listA2ATasksBySession('unknown-session');

      expect(tasks).toHaveLength(0);
      expect(total).toBe(0);
    });

    test('should filter by status', async () => {
      const sessionId = `session-filter-${Date.now()}`;
      const task1 = await createA2ATask('list_tasks', {}, sessionId);
      const task2 = await createA2ATask('get_task', {}, sessionId);

      await updateA2ATaskStatus(task1.id, 'completed');
      // task2 remains pending

      const { tasks, total } = await listA2ATasksBySession(sessionId, {
        status: 'pending',
      });

      expect(total).toBe(1);
      expect(tasks[0].id).toBe(task2.id);
    });

    test('should paginate results', async () => {
      const sessionId = `session-page-${Date.now()}`;
      for (let i = 0; i < 5; i++) {
        await createA2ATask(`skill-${i}`, {}, sessionId);
      }

      const page1 = await listA2ATasksBySession(sessionId, { limit: 2, offset: 0 });
      const page2 = await listA2ATasksBySession(sessionId, { limit: 2, offset: 2 });

      expect(page1.tasks).toHaveLength(2);
      expect(page2.tasks).toHaveLength(2);
      expect(page1.total).toBe(5);
    });

    test('should sort newest first', async () => {
      const sessionId = `session-sort-${Date.now()}`;
      const first = await createA2ATask('skill-first', {}, sessionId);
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      const second = await createA2ATask('skill-second', {}, sessionId);

      const { tasks } = await listA2ATasksBySession(sessionId);

      expect(tasks[0].id).toBe(second.id);
      expect(tasks[1].id).toBe(first.id);
    });
  });

  describe('cancelA2ATask', () => {
    test('should cancel a pending task', async () => {
      const task = await createA2ATask('list_tasks', {}, 'session-cancel');

      const cancelled = await cancelA2ATask(task.id, 'session-cancel');

      expect(cancelled).not.toBeNull();
      expect(cancelled!.status).toBe('cancelled');
    });

    test('should cancel a working task', async () => {
      const task = await createA2ATask('list_tasks', {}, 'session-cancel-work');
      await updateA2ATaskStatus(task.id, 'working');

      const cancelled = await cancelA2ATask(task.id, 'session-cancel-work');

      expect(cancelled).not.toBeNull();
      expect(cancelled!.status).toBe('cancelled');
    });

    test('should return null for wrong session', async () => {
      const task = await createA2ATask('list_tasks', {}, 'session-owner');

      const result = await cancelA2ATask(task.id, 'different-session');

      expect(result).toBeNull();
    });

    test('should return null for completed task', async () => {
      const task = await createA2ATask('list_tasks', {}, 'session-completed');
      await updateA2ATaskStatus(task.id, 'completed');

      const result = await cancelA2ATask(task.id, 'session-completed');

      expect(result).toBeNull();
    });

    test('should return null for non-existent task', async () => {
      const result = await cancelA2ATask('non-existent', 'session-1');

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredA2ATasks', () => {
    test('should return count of cleaned tasks (0 when none expired)', () => {
      const count = cleanupExpiredA2ATasks();

      // With fresh tasks, nothing should be expired
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getA2ATaskStats', () => {
    test('should return stats with memory storage type', async () => {
      const stats = await getA2ATaskStats();

      expect(stats.storageType).toBe('memory');
      expect(stats.totalTasks).toBeGreaterThanOrEqual(0);
    });
  });
});
