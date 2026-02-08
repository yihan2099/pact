import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase, createMockCache, createMockSharedTypes } from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockCache = createMockCache();
const mockTypes = createMockSharedTypes();

mockDb.setupMock();
mockCache.setupMock();
mockTypes.setupMock();

const { handleTaskRefunded } = await import('../../handlers/task-refunded');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'TaskRefunded',
    chainId: 84532,
    blockNumber: 600n,
    transactionHash: '0xrefund',
    logIndex: 0,
    args: {
      taskId: 1n,
      creator: '0xCreator',
      refundAmount: 2000n,
      ...overrides,
    },
  };
}

describe('handleTaskRefunded', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockCache.resetAll();
    mockTypes.resetAll();
    mockDb.getTaskByChainId.mockImplementation(() =>
      Promise.resolve({ id: 'db-task-1', status: 'in_review', chain_task_id: '1' })
    );
  });

  test('updates task status to refunded', async () => {
    await handleTaskRefunded(makeEvent());
    expect(mockDb.updateTask).toHaveBeenCalledWith('db-task-1', { status: 'refunded' });
  });

  test('validates status transition', async () => {
    await handleTaskRefunded(makeEvent());
    expect(mockTypes.assertValidStatusTransition).toHaveBeenCalledWith(
      'in_review',
      'refunded',
      '1'
    );
  });

  test('throws when task is not found', async () => {
    mockDb.getTaskByChainId.mockImplementation(() => Promise.resolve(null));
    await expect(handleTaskRefunded(makeEvent())).rejects.toThrow('not found in database');
  });

  test('invalidates task caches', async () => {
    await handleTaskRefunded(makeEvent());
    expect(mockCache.invalidateTaskCaches).toHaveBeenCalledWith('db-task-1');
  });
});
