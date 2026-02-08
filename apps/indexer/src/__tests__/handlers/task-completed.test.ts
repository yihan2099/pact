import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase, createMockCache, createMockSharedTypes } from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockCache = createMockCache();
const mockTypes = createMockSharedTypes();

mockDb.setupMock();
mockCache.setupMock();
mockTypes.setupMock();

const { handleTaskCompleted } = await import('../../handlers/task-completed');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'TaskCompleted',
    chainId: 84532,
    blockNumber: 400n,
    transactionHash: '0xcomplete',
    logIndex: 0,
    args: {
      taskId: 1n,
      winner: '0xWinner',
      bountyAmount: 5000n,
      ...overrides,
    },
  };
}

describe('handleTaskCompleted', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockCache.resetAll();
    mockTypes.resetAll();
    mockDb.getTaskByChainId.mockImplementation(() =>
      Promise.resolve({ id: 'db-task-1', status: 'in_review', chain_task_id: '1' })
    );
  });

  test('updates task status to completed with winner', async () => {
    await handleTaskCompleted(makeEvent());
    expect(mockDb.updateTask).toHaveBeenCalledWith('db-task-1', {
      status: 'completed',
      winner_address: '0xwinner',
    });
  });

  test('marks submission as winner and increments tasks_won', async () => {
    await handleTaskCompleted(makeEvent());
    expect(mockDb.markSubmissionAsWinner).toHaveBeenCalledWith('db-task-1', '0xwinner');
    expect(mockDb.incrementTasksWon).toHaveBeenCalledWith('0xWinner');
  });

  test('does not fail if incrementTasksWon throws', async () => {
    mockDb.incrementTasksWon.mockImplementation(() => Promise.reject(new Error('agent not found')));
    await expect(handleTaskCompleted(makeEvent())).resolves.toBeUndefined();
  });

  test('throws when task is not found', async () => {
    mockDb.getTaskByChainId.mockImplementation(() => Promise.resolve(null));
    await expect(handleTaskCompleted(makeEvent())).rejects.toThrow('not found in database');
  });

  test('invalidates task, agent, and submission caches', async () => {
    await handleTaskCompleted(makeEvent());
    expect(mockCache.invalidateTaskCaches).toHaveBeenCalledWith('db-task-1');
    expect(mockCache.invalidateAgentCaches).toHaveBeenCalledWith('0xwinner');
    expect(mockCache.invalidateSubmissionCaches).toHaveBeenCalledWith('db-task-1');
  });
});
