import { describe, test, expect, beforeEach, mock } from 'bun:test';

const mockGetA2ATask = mock(() =>
  Promise.resolve({
    id: 'task-uuid-1',
    status: 'pending',
    skillId: 'list_tasks',
    input: {},
    sessionId: 'session-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
);
const mockCancelA2ATask = mock(() =>
  Promise.resolve({
    id: 'task-uuid-1',
    status: 'cancelled',
    skillId: 'list_tasks',
    input: {},
    sessionId: 'session-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
);

mock.module('../../../a2a/task-store', () => ({
  getA2ATask: mockGetA2ATask,
  cancelA2ATask: mockCancelA2ATask,
}));

const mockGetServerContext = mock(() => ({
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
  isAuthenticated: true,
  isRegistered: true,
  sessionId: 'session-1',
}));
const mockGetSessionIdFromContext = mock(() => 'session-1');

mock.module('../../../a2a/a2a-auth', () => ({
  getServerContext: mockGetServerContext,
  getSessionIdFromContext: mockGetSessionIdFromContext,
}));

import { handleTasksCancel } from '../../../a2a/handlers/tasks-cancel';
import { A2A_ERROR_CODES } from '../../../a2a/types';

function createMockHonoContext() {
  return {} as any;
}

describe('handleTasksCancel', () => {
  beforeEach(() => {
    mockGetA2ATask.mockReset();
    mockGetA2ATask.mockResolvedValue({
      id: 'task-uuid-1',
      status: 'pending',
      skillId: 'list_tasks',
      input: {},
      sessionId: 'session-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    mockCancelA2ATask.mockReset();
    mockCancelA2ATask.mockResolvedValue({
      id: 'task-uuid-1',
      status: 'cancelled',
      skillId: 'list_tasks',
      input: {},
      sessionId: 'session-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    mockGetServerContext.mockReset();
    mockGetServerContext.mockReturnValue({
      callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
      isAuthenticated: true,
      isRegistered: true,
      sessionId: 'session-1',
    });
    mockGetSessionIdFromContext.mockReset();
    mockGetSessionIdFromContext.mockReturnValue('session-1');
  });

  test('should cancel a pending task owned by session', async () => {
    const c = createMockHonoContext();

    const response = await handleTasksCancel(c, 'req-1', {
      taskId: 'task-uuid-1',
    });

    expect(response.jsonrpc).toBe('2.0');
    expect(response.result).toBeDefined();
    expect((response.result as any).status).toBe('cancelled');
  });

  test('should return error for missing taskId', async () => {
    const c = createMockHonoContext();

    const response = await handleTasksCancel(c, 'req-2', {} as any);

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(A2A_ERROR_CODES.INVALID_PARAMS);
  });

  test('should return SESSION_REQUIRED when not authenticated', async () => {
    mockGetServerContext.mockReturnValue({
      callerAddress: '0x0000000000000000000000000000000000000000',
      isAuthenticated: false,
      isRegistered: false,
      sessionId: null as any,
    });
    mockGetSessionIdFromContext.mockReturnValue(null as any);
    const c = createMockHonoContext();

    const response = await handleTasksCancel(c, 'req-3', {
      taskId: 'task-uuid-1',
    });

    expect(response.error!.code).toBe(A2A_ERROR_CODES.SESSION_REQUIRED);
  });

  test('should return TASK_NOT_FOUND for non-existent task', async () => {
    mockGetA2ATask.mockResolvedValue(null as any);
    const c = createMockHonoContext();

    const response = await handleTasksCancel(c, 'req-4', {
      taskId: 'non-existent',
    });

    expect(response.error!.code).toBe(A2A_ERROR_CODES.TASK_NOT_FOUND);
  });

  test('should return ACCESS_DENIED for wrong session', async () => {
    mockGetA2ATask.mockResolvedValue({
      id: 'task-uuid-1',
      status: 'pending',
      skillId: 'list_tasks',
      input: {},
      sessionId: 'other-session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const c = createMockHonoContext();

    const response = await handleTasksCancel(c, 'req-5', {
      taskId: 'task-uuid-1',
    });

    expect(response.error!.code).toBe(A2A_ERROR_CODES.ACCESS_DENIED);
  });

  test('should return error for already completed task', async () => {
    mockGetA2ATask.mockResolvedValue({
      id: 'task-uuid-1',
      status: 'completed',
      skillId: 'list_tasks',
      input: {},
      sessionId: 'session-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const c = createMockHonoContext();

    const response = await handleTasksCancel(c, 'req-6', {
      taskId: 'task-uuid-1',
    });

    expect(response.error!.code).toBe(A2A_ERROR_CODES.TASK_ALREADY_COMPLETED);
  });

  test('should return error for already cancelled task', async () => {
    mockGetA2ATask.mockResolvedValue({
      id: 'task-uuid-1',
      status: 'cancelled',
      skillId: 'list_tasks',
      input: {},
      sessionId: 'session-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const c = createMockHonoContext();

    const response = await handleTasksCancel(c, 'req-7', {
      taskId: 'task-uuid-1',
    });

    expect(response.error!.code).toBe(A2A_ERROR_CODES.TASK_CANCELLED);
  });
});
