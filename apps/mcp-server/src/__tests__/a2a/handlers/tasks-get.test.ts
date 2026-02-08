import { describe, test, expect, beforeEach, mock } from 'bun:test';

const mockGetA2ATask = mock(() =>
  Promise.resolve({
    id: 'task-uuid-1',
    status: 'completed',
    skillId: 'list_tasks',
    input: {},
    sessionId: 'session-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    output: { type: 'result', data: { tasks: [] } },
  })
);

mock.module('../../../a2a/task-store', () => ({
  getA2ATask: mockGetA2ATask,
}));

const mockGetSessionIdFromContext = mock(() => 'session-1');

mock.module('../../../a2a/a2a-auth', () => ({
  getSessionIdFromContext: mockGetSessionIdFromContext,
}));

import { handleTasksGet } from '../../../a2a/handlers/tasks-get';
import { A2A_ERROR_CODES } from '../../../a2a/types';

function createMockHonoContext() {
  return {} as any;
}

describe('handleTasksGet', () => {
  beforeEach(() => {
    mockGetA2ATask.mockReset();
    mockGetA2ATask.mockResolvedValue({
      id: 'task-uuid-1',
      status: 'completed',
      skillId: 'list_tasks',
      input: {},
      sessionId: 'session-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);
    mockGetSessionIdFromContext.mockReset();
    mockGetSessionIdFromContext.mockReturnValue('session-1');
  });

  test('should return task for valid taskId and matching session', async () => {
    const c = createMockHonoContext();

    const response = await handleTasksGet(c, 'req-1', { taskId: 'task-uuid-1' });

    expect(response.jsonrpc).toBe('2.0');
    expect(response.result).toBeDefined();
    expect((response.result as any).id).toBe('task-uuid-1');
  });

  test('should return error for missing taskId', async () => {
    const c = createMockHonoContext();

    const response = await handleTasksGet(c, 'req-2', {} as any);

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(A2A_ERROR_CODES.INVALID_PARAMS);
  });

  test('should return TASK_NOT_FOUND for non-existent task', async () => {
    mockGetA2ATask.mockResolvedValue(null as any);
    const c = createMockHonoContext();

    const response = await handleTasksGet(c, 'req-3', {
      taskId: 'non-existent',
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(A2A_ERROR_CODES.TASK_NOT_FOUND);
  });

  test('should return ACCESS_DENIED for wrong session', async () => {
    mockGetSessionIdFromContext.mockReturnValue('different-session');
    const c = createMockHonoContext();

    const response = await handleTasksGet(c, 'req-4', {
      taskId: 'task-uuid-1',
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(A2A_ERROR_CODES.ACCESS_DENIED);
    expect(response.error!.message).toContain('different session');
  });

  test('should deny access even for anonymous tasks from different session', async () => {
    mockGetA2ATask.mockResolvedValue({
      id: 'task-uuid-anon',
      status: 'completed',
      skillId: 'list_tasks',
      input: {},
      sessionId: 'anonymous-uuid-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);
    mockGetSessionIdFromContext.mockReturnValue('session-1');
    const c = createMockHonoContext();

    const response = await handleTasksGet(c, 'req-5', {
      taskId: 'task-uuid-anon',
    });

    expect(response.error!.code).toBe(A2A_ERROR_CODES.ACCESS_DENIED);
  });
});
