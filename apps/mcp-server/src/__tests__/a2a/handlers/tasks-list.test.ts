import { describe, test, expect, beforeEach, mock } from 'bun:test';

const mockListA2ATasksBySession = mock(() =>
  Promise.resolve({
    tasks: [
      {
        id: 'task-1',
        status: 'completed',
        skillId: 'list_tasks',
        input: {},
        sessionId: 'session-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    total: 1,
  })
);

mock.module('../../../a2a/task-store', () => ({
  listA2ATasksBySession: mockListA2ATasksBySession,
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

import { handleTasksList } from '../../../a2a/handlers/tasks-list';
import { A2A_ERROR_CODES } from '../../../a2a/types';

function createMockHonoContext() {
  return {} as any;
}

describe('handleTasksList', () => {
  beforeEach(() => {
    mockListA2ATasksBySession.mockReset();
    mockListA2ATasksBySession.mockResolvedValue({
      tasks: [{ id: 'task-1', status: 'completed', skillId: 'list_tasks' } as any],
      total: 1,
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

  test('should return tasks for authenticated session', async () => {
    const c = createMockHonoContext();

    const response = await handleTasksList(c, 'req-1', {});

    expect(response.jsonrpc).toBe('2.0');
    expect(response.result).toBeDefined();
    expect((response.result as any).tasks).toHaveLength(1);
    expect((response.result as any).total).toBe(1);
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

    const response = await handleTasksList(c, 'req-2', {});

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(A2A_ERROR_CODES.SESSION_REQUIRED);
  });

  test('should pass pagination parameters', async () => {
    const c = createMockHonoContext();

    await handleTasksList(c, 'req-3', { limit: 50, offset: 10 });

    expect(mockListA2ATasksBySession).toHaveBeenCalledWith('session-1', {
      limit: 50,
      offset: 10,
      status: undefined,
    });
  });

  test('should clamp limit to valid range', async () => {
    const c = createMockHonoContext();

    await handleTasksList(c, 'req-4', { limit: 200, offset: 0 });

    // Should be clamped to 100
    const calledArgs = (mockListA2ATasksBySession.mock.calls[0] as any[])[1];
    expect(calledArgs.limit).toBe(100);
  });

  test('should pass status filter', async () => {
    const c = createMockHonoContext();

    await handleTasksList(c, 'req-5', { status: 'completed' });

    const calledArgs = (mockListA2ATasksBySession.mock.calls[0] as any[])[1];
    expect(calledArgs.status).toBe('completed');
  });
});
