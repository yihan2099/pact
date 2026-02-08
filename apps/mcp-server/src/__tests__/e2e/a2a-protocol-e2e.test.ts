/**
 * A2A Protocol E2E Tests
 *
 * Tests the A2A protocol endpoints with mocked infrastructure.
 * Verifies agent card generation, JSON-RPC routing, and task management.
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock contract addresses
mock.module('@clawboy/contracts', () => ({
  getContractAddresses: () => ({
    taskManager: '0x1111111111111111111111111111111111111111',
    escrowVault: '0x2222222222222222222222222222222222222222',
    disputeResolver: '0x3333333333333333333333333333333333333333',
    agentAdapter: '0x4444444444444444444444444444444444444444',
    identityRegistry: '0x5555555555555555555555555555555555555555',
    reputationRegistry: '0x6666666666666666666666666666666666666666',
    timelockController: '0x7777777777777777777777777777777777777777',
  }),
  TaskManagerABI: [],
  ClawboyAgentAdapterABI: [],
  ERC8004IdentityRegistryABI: [],
}));

mock.module('../../config/chain', () => ({
  getChainId: () => 84532,
}));

// Mock rate-limit (redis client)
mock.module('@clawboy/rate-limit', () => ({
  getRedisClient: () => null,
}));

// Import after mocks
import { generateAgentCard, getSkillById, skillExists } from '../../a2a/agent-card';
import { A2A_ERROR_CODES, createErrorResponse, createSuccessResponse } from '../../a2a/types';
import {
  validateParams,
  messageSendParamsSchema,
  tasksGetParamsSchema,
  tasksListParamsSchema,
  tasksCancelParamsSchema,
} from '../../a2a/validators';
import {
  createA2ATask,
  getA2ATask,
  updateA2ATaskStatus,
  listA2ATasksBySession,
  cancelA2ATask,
  cleanupExpiredA2ATasks,
} from '../../a2a/task-store';

// ============================================================================
// Agent Card Tests
// ============================================================================

describe('A2A Agent Card', () => {
  test('generates valid agent card with required fields', () => {
    const card = generateAgentCard();

    expect(card.name).toBe('Pact');
    expect(card.description).toBeDefined();
    expect(card.url).toBeDefined();
    expect(card.version).toBeDefined();
    expect(card.protocolVersion).toBe('1.0');
    expect(card.capabilities).toBeDefined();
    expect(card.skills).toBeDefined();
    expect(Array.isArray(card.skills)).toBe(true);
  });

  test('agent card has correct capabilities', () => {
    const card = generateAgentCard();

    expect(card.capabilities.streaming).toBe(true);
    expect(card.capabilities.pushNotifications).toBe(false);
    expect(card.capabilities.statefulness).toBe(true);
  });

  test('agent card includes authentication schemes', () => {
    const card = generateAgentCard();

    expect(card.authentication).toBeDefined();
    expect(card.authentication!.schemes.length).toBeGreaterThan(0);

    const schemes = card.authentication!.schemes.map((s) => s.scheme);
    expect(schemes).toContain('wallet-signature');
    expect(schemes).toContain('bearer');
  });

  test('agent card skills have required structure', () => {
    const card = generateAgentCard();

    for (const skill of card.skills) {
      expect(skill.id).toBeDefined();
      expect(typeof skill.id).toBe('string');
      expect(skill.name).toBeDefined();
      expect(skill.description).toBeDefined();
      expect(skill.inputSchema).toBeDefined();
    }
  });

  test('agent card includes ERC-8004 identity info', () => {
    const card = generateAgentCard();

    expect(card.identity).toBeDefined();
    expect(card.identity!.erc8004).toBeDefined();
    expect(card.identity!.erc8004.chainId).toBe(84532);
    expect(card.identity!.erc8004.agentAdapter).toBeDefined();
    expect(card.identity!.erc8004.identityRegistry).toBeDefined();
    expect(card.identity!.erc8004.reputationRegistry).toBeDefined();
  });

  test('skillExists returns true for known skills', () => {
    const card = generateAgentCard();
    if (card.skills.length > 0) {
      expect(skillExists(card.skills[0]!.id)).toBe(true);
    }
  });

  test('skillExists returns false for unknown skills', () => {
    expect(skillExists('nonexistent_skill_xyz')).toBe(false);
  });

  test('getSkillById returns skill for valid ID', () => {
    const card = generateAgentCard();
    if (card.skills.length > 0) {
      const skill = getSkillById(card.skills[0]!.id);
      expect(skill).toBeDefined();
      expect(skill!.id).toBe(card.skills[0]!.id);
    }
  });
});

// ============================================================================
// JSON-RPC Helper Tests
// ============================================================================

describe('A2A JSON-RPC helpers', () => {
  test('createErrorResponse builds correct structure', () => {
    const resp = createErrorResponse('req-1', A2A_ERROR_CODES.PARSE_ERROR, 'Bad JSON');

    expect(resp.jsonrpc).toBe('2.0');
    expect(resp.id).toBe('req-1');
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(-32700);
    expect(resp.error!.message).toBe('Bad JSON');
    expect(resp.result).toBeUndefined();
  });

  test('createSuccessResponse builds correct structure', () => {
    const resp = createSuccessResponse('req-2', { status: 'ok' });

    expect(resp.jsonrpc).toBe('2.0');
    expect(resp.id).toBe('req-2');
    expect(resp.result).toEqual({ status: 'ok' });
    expect(resp.error).toBeUndefined();
  });

  test('createErrorResponse supports null id', () => {
    const resp = createErrorResponse(null, A2A_ERROR_CODES.INVALID_REQUEST, 'Missing id');
    expect(resp.id).toBeNull();
  });

  test('createErrorResponse supports optional data field', () => {
    const resp = createErrorResponse('r1', A2A_ERROR_CODES.INTERNAL_ERROR, 'Error', {
      detail: 'stack trace',
    });
    expect(resp.error!.data).toEqual({ detail: 'stack trace' });
  });
});

// ============================================================================
// Parameter Validation Tests
// ============================================================================

describe('A2A parameter validation', () => {
  test('message/send validates skillId is required', () => {
    const result = validateParams(messageSendParamsSchema, {});
    expect(result.success).toBe(false);
  });

  test('message/send accepts valid params', () => {
    const result = validateParams(messageSendParamsSchema, {
      skillId: 'list_tasks',
      input: { status: 'open' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skillId).toBe('list_tasks');
    }
  });

  test('message/send defaults input to empty object', () => {
    const result = validateParams(messageSendParamsSchema, { skillId: 'list_tasks' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.input).toEqual({});
    }
  });

  test('tasks/get validates taskId is a UUID', () => {
    const result = validateParams(tasksGetParamsSchema, { taskId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  test('tasks/get accepts valid UUID', () => {
    const result = validateParams(tasksGetParamsSchema, {
      taskId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  test('tasks/list accepts empty params', () => {
    const result = validateParams(tasksListParamsSchema, undefined);
    expect(result.success).toBe(true);
  });

  test('tasks/list validates status enum', () => {
    const result = validateParams(tasksListParamsSchema, { status: 'invalid_status' });
    expect(result.success).toBe(false);
  });

  test('tasks/cancel validates taskId format', () => {
    const result = validateParams(tasksCancelParamsSchema, { taskId: '' });
    expect(result.success).toBe(false);
  });

  test('rejects extra fields with strict mode', () => {
    const result = validateParams(messageSendParamsSchema, {
      skillId: 'list_tasks',
      extraField: 'not allowed',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// A2A Task Store Tests
// ============================================================================

describe('A2A Task Store (in-memory)', () => {
  beforeEach(() => {
    // Clean up tasks between tests
    cleanupExpiredA2ATasks();
  });

  test('creates a new task with pending status', async () => {
    const task = await createA2ATask('list_tasks', { status: 'open' }, 'session-1');

    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');
    expect(task.skillId).toBe('list_tasks');
    expect(task.sessionId).toBe('session-1');
    expect(task.input).toEqual({ status: 'open' });
  });

  test('retrieves a task by ID', async () => {
    const created = await createA2ATask('get_task', { taskId: '1' }, 'session-1');
    const retrieved = await getA2ATask(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.skillId).toBe('get_task');
  });

  test('returns null for non-existent task', async () => {
    const result = await getA2ATask('nonexistent-id');
    expect(result).toBeNull();
  });

  test('updates task status', async () => {
    const task = await createA2ATask('list_tasks', {}, 'session-1');
    const updated = await updateA2ATaskStatus(task.id, 'completed', {
      type: 'result',
      data: [{ id: '1', title: 'Task' }],
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('completed');
    expect(updated!.output).toBeDefined();
    expect(updated!.output!.type).toBe('result');
  });

  test('lists tasks by session', async () => {
    const sessionId = `session-list-${Date.now()}`;
    await createA2ATask('list_tasks', {}, sessionId);
    await createA2ATask('get_task', { taskId: '1' }, sessionId);
    await createA2ATask('get_capabilities', {}, sessionId);

    const { tasks, total } = await listA2ATasksBySession(sessionId);
    expect(total).toBe(3);
    expect(tasks.length).toBe(3);
  });

  test('lists tasks filtered by status', async () => {
    const sessionId = `session-filter-${Date.now()}`;
    const task1 = await createA2ATask('list_tasks', {}, sessionId);
    await createA2ATask('get_task', {}, sessionId);

    await updateA2ATaskStatus(task1.id, 'completed');

    const { tasks } = await listA2ATasksBySession(sessionId, { status: 'completed' });
    expect(tasks.length).toBe(1);
    expect(tasks[0]!.status).toBe('completed');
  });

  test('cancels pending task', async () => {
    const sessionId = `session-cancel-${Date.now()}`;
    const task = await createA2ATask('list_tasks', {}, sessionId);

    const cancelled = await cancelA2ATask(task.id, sessionId);
    expect(cancelled).not.toBeNull();
    expect(cancelled!.status).toBe('cancelled');
  });

  test('cannot cancel task from different session', async () => {
    const task = await createA2ATask('list_tasks', {}, 'session-owner');

    const result = await cancelA2ATask(task.id, 'session-other');
    expect(result).toBeNull();
  });

  test('cannot cancel completed task', async () => {
    const sessionId = `session-no-cancel-${Date.now()}`;
    const task = await createA2ATask('list_tasks', {}, sessionId);
    await updateA2ATaskStatus(task.id, 'completed');

    const result = await cancelA2ATask(task.id, sessionId);
    expect(result).toBeNull();
  });

  test('returns empty list for unknown session', async () => {
    const { tasks, total } = await listA2ATasksBySession('unknown-session');
    expect(tasks).toEqual([]);
    expect(total).toBe(0);
  });
});

// ============================================================================
// Error Code Tests
// ============================================================================

describe('A2A error codes', () => {
  test('standard JSON-RPC error codes are correct', () => {
    expect(A2A_ERROR_CODES.PARSE_ERROR).toBe(-32700);
    expect(A2A_ERROR_CODES.INVALID_REQUEST).toBe(-32600);
    expect(A2A_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
    expect(A2A_ERROR_CODES.INVALID_PARAMS).toBe(-32602);
    expect(A2A_ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
  });

  test('A2A-specific error codes are correct', () => {
    expect(A2A_ERROR_CODES.TASK_NOT_FOUND).toBe(-32001);
    expect(A2A_ERROR_CODES.ACCESS_DENIED).toBe(-32002);
    expect(A2A_ERROR_CODES.SKILL_NOT_FOUND).toBe(-32003);
    expect(A2A_ERROR_CODES.TASK_CANCELLED).toBe(-32004);
    expect(A2A_ERROR_CODES.TASK_ALREADY_COMPLETED).toBe(-32005);
    expect(A2A_ERROR_CODES.SESSION_REQUIRED).toBe(-32006);
  });
});
