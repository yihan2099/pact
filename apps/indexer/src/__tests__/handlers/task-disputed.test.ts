import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase, createMockCache, createMockSharedTypes } from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockCache = createMockCache();
const mockTypes = createMockSharedTypes();

mockDb.setupMock();
mockCache.setupMock();
mockTypes.setupMock();

const { handleTaskDisputed } = await import('../../handlers/task-disputed');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'TaskDisputed',
    chainId: 84532,
    blockNumber: 700n,
    transactionHash: '0xdispute',
    logIndex: 0,
    args: {
      taskId: 1n,
      disputer: '0xDisputer',
      disputeId: 42n,
      ...overrides,
    },
  };
}

describe('handleTaskDisputed', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockCache.resetAll();
    mockTypes.resetAll();
    mockDb.getTaskByChainId.mockImplementation(() =>
      Promise.resolve({ id: 'db-task-1', status: 'in_review', chain_task_id: '1' })
    );
  });

  test('updates task status to disputed', async () => {
    await handleTaskDisputed(makeEvent());
    expect(mockDb.updateTask).toHaveBeenCalledWith('db-task-1', { status: 'disputed' });
  });

  test('validates status transition', async () => {
    await handleTaskDisputed(makeEvent());
    expect(mockTypes.assertValidStatusTransition).toHaveBeenCalledWith(
      'in_review',
      'disputed',
      '1'
    );
  });

  test('throws when task is not found', async () => {
    mockDb.getTaskByChainId.mockImplementation(() => Promise.resolve(null));
    await expect(handleTaskDisputed(makeEvent())).rejects.toThrow('not found in database');
  });

  test('invalidates task caches', async () => {
    await handleTaskDisputed(makeEvent());
    expect(mockCache.invalidateTaskCaches).toHaveBeenCalledWith('db-task-1');
  });
});
