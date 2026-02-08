import { describe, test, expect, beforeEach, mock } from 'bun:test';

const mockCreateA2ATask = mock(() =>
  Promise.resolve({
    id: 'stream-task-1',
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

const mockExecuteSkill = mock(() => Promise.resolve({ success: true, data: { tasks: [] } }));
const mockSkillRequiresAuth = mock(() => false);

mock.module('../../../a2a/skill-bridge', () => ({
  executeSkill: mockExecuteSkill,
  skillRequiresAuth: mockSkillRequiresAuth,
}));

const mockSkillExists = mock(() => true);

mock.module('../../../a2a/agent-card', () => ({
  skillExists: mockSkillExists,
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

// Mock hono/streaming - must await the handler to capture side effects
let streamHandlerPromise: Promise<void> | null = null;
mock.module('hono/streaming', () => ({
  streamSSE: mock((c: any, handler: (stream: any) => Promise<void>) => {
    const events: any[] = [];
    const mockStream = {
      writeSSE: mock((event: any) => {
        events.push(event);
        return Promise.resolve();
      }),
    };
    // Store the handler promise so tests can await it
    streamHandlerPromise = handler(mockStream);
    const resp = new Response('', { headers: { 'content-type': 'text/event-stream' } });
    (resp as any).__events = events;
    (resp as any).__mockStream = mockStream;
    return resp;
  }),
}));

import { handleMessageStream } from '../../../a2a/handlers/message-stream';
import { A2A_ERROR_CODES } from '../../../a2a/types';

function createMockHonoContext() {
  return {
    json: (data: any, status?: number) => {
      const resp = new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'content-type': 'application/json' },
      });
      (resp as any).__data = data;
      return resp;
    },
  } as any;
}

describe('handleMessageStream', () => {
  beforeEach(() => {
    mockCreateA2ATask.mockReset();
    mockCreateA2ATask.mockResolvedValue({
      id: 'stream-task-1',
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
    mockExecuteSkill.mockResolvedValue({ success: true, data: { tasks: [] } });
    mockSkillExists.mockReset();
    mockSkillExists.mockReturnValue(true);
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

  test('should return SSE stream response', async () => {
    const c = createMockHonoContext();

    const response = await handleMessageStream(c, 'req-1', {
      skillId: 'list_tasks',
    });

    expect(response).toBeInstanceOf(Response);
  });

  test('should return error JSON for missing skillId', async () => {
    const c = createMockHonoContext();

    const response = await handleMessageStream(c, 'req-2', {} as any);

    const data = (response as any).__data;
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(A2A_ERROR_CODES.INVALID_PARAMS);
  });

  test('should return error for unknown skill', async () => {
    mockSkillExists.mockReturnValue(false);
    const c = createMockHonoContext();

    const response = await handleMessageStream(c, 'req-3', {
      skillId: 'nonexistent',
    });

    const data = (response as any).__data;
    expect(data.error.code).toBe(A2A_ERROR_CODES.SKILL_NOT_FOUND);
  });

  test('should return 401 when auth required but missing', async () => {
    mockSkillRequiresAuth.mockReturnValue(true);
    mockGetServerContext.mockReturnValue({
      callerAddress: '0x0000000000000000000000000000000000000000',
      isAuthenticated: false,
      isRegistered: false,
      sessionId: null as any,
    });
    const c = createMockHonoContext();

    const response = await handleMessageStream(c, 'req-4', {
      skillId: 'create_task',
    });

    expect(response.status).toBe(401);
    const data = (response as any).__data;
    expect(data.error.code).toBe(A2A_ERROR_CODES.SESSION_REQUIRED);
  });

  test('should create task and execute skill', async () => {
    const c = createMockHonoContext();

    await handleMessageStream(c, 'req-5', { skillId: 'list_tasks' });
    // Wait for the stream handler callback to complete
    if (streamHandlerPromise) await streamHandlerPromise;

    expect(mockCreateA2ATask).toHaveBeenCalled();
    expect(mockExecuteSkill).toHaveBeenCalled();
  });

  test('should use anonymous session when no session', async () => {
    mockGetSessionIdFromContext.mockReturnValue(null as any);
    const c = createMockHonoContext();

    await handleMessageStream(c, 'req-6', { skillId: 'list_tasks' });
    if (streamHandlerPromise) await streamHandlerPromise;

    const sessionArg = (mockCreateA2ATask.mock.calls[0] as any[])[2];
    expect(sessionArg).toContain('anonymous-');
  });
});
