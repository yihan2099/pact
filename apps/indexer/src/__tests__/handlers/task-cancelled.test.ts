import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase, createMockCache, createMockSharedTypes } from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockCache = createMockCache();
const mockTypes = createMockSharedTypes();

mockDb.setupMock();
mockCache.setupMock();
mockTypes.setupMock();

const { handleTaskCancelled } = await import('../../handlers/task-cancelled');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'TaskCancelled',
    chainId: 84532,
    blockNumber: 500n,
    transactionHash: '0xcancel',
    logIndex: 0,
    args: {
      taskId: 1n,
      creator: '0xCreator',
      refundAmount: 1000n,
      ...overrides,
    },
  };
}

describe('handleTaskCancelled', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockCache.resetAll();
    mockTypes.resetAll();
    mockDb.getTaskByChainId.mockImplementation(() =>
      Promise.resolve({ id: 'db-task-1', status: 'open', chain_task_id: '1' })
    );
  });

  test('updates task status to cancelled', async () => {
    await handleTaskCancelled(makeEvent());
    expect(mockDb.updateTask).toHaveBeenCalledWith('db-task-1', { status: 'cancelled' });
  });

  test('validates status transition', async () => {
    await handleTaskCancelled(makeEvent());
    expect(mockTypes.assertValidStatusTransition).toHaveBeenCalledWith('open', 'cancelled', '1');
  });

  test('throws when task is not found', async () => {
    mockDb.getTaskByChainId.mockImplementation(() => Promise.resolve(null));
    await expect(handleTaskCancelled(makeEvent())).rejects.toThrow('not found in database');
  });

  test('invalidates task caches', async () => {
    await handleTaskCancelled(makeEvent());
    expect(mockCache.invalidateTaskCaches).toHaveBeenCalledWith('db-task-1');
  });
});
