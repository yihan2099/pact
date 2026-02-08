import { describe, test, expect, beforeEach, mock } from 'bun:test';

const mockCreateA2ATask = mock(() =>
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
const mockUpdateA2ATaskStatus = mock((id: string, status: string, output?: any, error?: any) =>
  Promise.resolve({
    id,
    status,
    skillId: 'list_tasks',
    input: {},
    sessionId: 'session-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...(output && { output }),
    ...(error && { error }),
  })
);

mock.module('../../../a2a/task-store', () => ({
  createA2ATask: mockCreateA2ATask,
  updateA2ATaskStatus: mockUpdateA2ATaskStatus,
}));

const mockExecuteSkill = mock(() =>
  Promise.resolve({ success: true, data: { tasks: [], total: 0 } })
);
const mockSkillRequiresAuth = mock(() => false);

mock.module('../../../a2a/skill-bridge', () => ({
  executeSkill: mockExecuteSkill,
  skillRequiresAuth: mockSkillRequiresAuth,
}));

const mockSkillExistsCard = mock(() => true);

mock.module('../../../a2a/agent-card', () => ({
  skillExists: mockSkillExistsCard,
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

import { handleMessageSend } from '../../../a2a/handlers/message-send';
import { A2A_ERROR_CODES } from '../../../a2a/types';

function createMockHonoContext() {
  return {} as any;
}

describe('handleMessageSend', () => {
  beforeEach(() => {
    mockCreateA2ATask.mockReset();
    mockCreateA2ATask.mockResolvedValue({
      id: 'task-uuid-1',
      status: 'pending',
      skillId: 'list_tasks',
      input: {},
      sessionId: 'session-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    mockUpdateA2ATaskStatus.mockReset();
    mockUpdateA2ATaskStatus.mockImplementation((id, status, output, error) =>
      Promise.resolve({
        id,
        status,
        skillId: 'list_tasks',
        input: {},
        sessionId: 'session-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...(output && { output }),
        ...(error && { error }),
      })
    );
    mockExecuteSkill.mockReset();
    mockExecuteSkill.mockResolvedValue({ success: true, data: { tasks: [], total: 0 } });
    mockSkillExistsCard.mockReset();
    mockSkillExistsCard.mockReturnValue(true);
    mockSkillRequiresAuth.mockReset();
    mockSkillRequiresAuth.mockReturnValue(false);
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

  test('should execute skill and return completed task', async () => {
    const c = createMockHonoContext();

    const response = await handleMessageSend(c, 'req-1', {
      skillId: 'list_tasks',
      input: {},
    });

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('req-1');
    expect(response.result).toBeDefined();
    expect((response.result as any).status).toBe('completed');
  });

  test('should return error for missing skillId', async () => {
    const c = createMockHonoContext();

    await handleMessageSend(c, 'req-2', {
      skillId: '',
    } as any);

    // skillId is empty - skillExists returns false
    mockSkillExistsCard.mockReturnValue(false);
    const resp2 = await handleMessageSend(c, 'req-2', { skillId: '' } as any);

    expect(resp2.error).toBeDefined();
  });

  test('should return SKILL_NOT_FOUND for unknown skill', async () => {
    mockSkillExistsCard.mockReturnValue(false);
    const c = createMockHonoContext();

    const response = await handleMessageSend(c, 'req-3', {
      skillId: 'nonexistent',
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(A2A_ERROR_CODES.SKILL_NOT_FOUND);
  });

  test('should return SESSION_REQUIRED when auth needed but missing', async () => {
    mockSkillRequiresAuth.mockReturnValue(true);
    mockGetServerContext.mockReturnValue({
      callerAddress: '0x0000000000000000000000000000000000000000',
      isAuthenticated: false,
      isRegistered: false,
      sessionId: null as any,
    });
    const c = createMockHonoContext();

    const response = await handleMessageSend(c, 'req-4', {
      skillId: 'create_task',
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(A2A_ERROR_CODES.SESSION_REQUIRED);
  });

  test('should create task and update status through lifecycle', async () => {
    const c = createMockHonoContext();

    await handleMessageSend(c, 'req-5', { skillId: 'list_tasks' });

    // Should create task, update to working, execute, update to completed
    expect(mockCreateA2ATask).toHaveBeenCalledWith('list_tasks', {}, 'session-1');
    expect(mockUpdateA2ATaskStatus).toHaveBeenCalledWith('task-uuid-1', 'working');
    expect(mockExecuteSkill).toHaveBeenCalled();
  });

  test('should handle skill execution failure', async () => {
    mockExecuteSkill.mockResolvedValue({
      success: false,
      error: { code: -32603, message: 'Something broke' },
    } as any);
    const c = createMockHonoContext();

    const response = await handleMessageSend(c, 'req-6', {
      skillId: 'list_tasks',
    });

    expect((response.result as any).status).toBe('failed');
    expect((response.result as any).error).toBeDefined();
  });

  test('should use anonymous session for unauthenticated public skills', async () => {
    mockGetSessionIdFromContext.mockReturnValue(null as any);
    const c = createMockHonoContext();

    await handleMessageSend(c, 'req-7', { skillId: 'list_tasks' });

    const sessionArg = (mockCreateA2ATask.mock.calls[0] as any[])[2];
    expect(sessionArg).toContain('anonymous-');
  });

  test('should pass input to skill execution', async () => {
    const c = createMockHonoContext();
    const input = { status: 'open', limit: 10 };

    await handleMessageSend(c, 'req-8', { skillId: 'list_tasks', input });

    expect(mockExecuteSkill).toHaveBeenCalledWith('list_tasks', input, expect.any(Object));
  });
});
