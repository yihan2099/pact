import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase, createMockCache, createMockSharedTypes } from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockCache = createMockCache();
const mockTypes = createMockSharedTypes();

mockDb.setupMock();
mockCache.setupMock();
mockTypes.setupMock();

const { handleWinnerSelected } = await import('../../handlers/winner-selected');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'WinnerSelected',
    chainId: 84532,
    blockNumber: 300n,
    transactionHash: '0xwin',
    logIndex: 0,
    args: {
      taskId: 1n,
      winner: '0xWinner',
      challengeDeadline: 1700172800n,
      ...overrides,
    },
  };
}

describe('handleWinnerSelected', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockCache.resetAll();
    mockTypes.resetAll();
    mockDb.getTaskByChainId.mockImplementation(() =>
      Promise.resolve({ id: 'db-task-1', status: 'open', chain_task_id: '1' })
    );
  });

  test('updates task with winner and in_review status', async () => {
    await handleWinnerSelected(makeEvent());
    expect(mockDb.updateTask).toHaveBeenCalledTimes(1);
    const [taskId, updates] = mockDb.updateTask.mock.calls[0];
    expect(taskId).toBe('db-task-1');
    expect(updates.status).toBe('in_review');
    expect(updates.winner_address).toBe('0xwinner');
  });

  test('computes challenge deadline from unix timestamp', async () => {
    await handleWinnerSelected(makeEvent({ challengeDeadline: 1700172800n }));
    const updates = mockDb.updateTask.mock.calls[0][1];
    expect(updates.challenge_deadline).toBe(new Date(1700172800 * 1000).toISOString());
  });

  test('validates status transition', async () => {
    await handleWinnerSelected(makeEvent());
    expect(mockTypes.assertValidStatusTransition).toHaveBeenCalledWith('open', 'in_review', '1');
  });

  test('throws when task is not found', async () => {
    mockDb.getTaskByChainId.mockImplementation(() => Promise.resolve(null));
    await expect(handleWinnerSelected(makeEvent())).rejects.toThrow('not found in database');
  });

  test('invalidates task and submission caches', async () => {
    await handleWinnerSelected(makeEvent());
    expect(mockCache.invalidateTaskCaches).toHaveBeenCalledWith('db-task-1');
    expect(mockCache.invalidateSubmissionCaches).toHaveBeenCalledWith('db-task-1');
  });
});
