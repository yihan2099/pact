import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase, createMockCache } from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockCache = createMockCache();

mockDb.setupMock();
mockCache.setupMock();

const { handleAllSubmissionsRejected } = await import('../../handlers/submissions-rejected');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'AllSubmissionsRejected',
    chainId: 84532,
    blockNumber: 800n,
    transactionHash: '0xreject',
    logIndex: 0,
    args: {
      taskId: 1n,
      creator: '0xCreator',
      reason: 'Poor quality',
      ...overrides,
    },
  };
}

describe('handleAllSubmissionsRejected', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockCache.resetAll();
    mockDb.getTaskByChainId.mockImplementation(() =>
      Promise.resolve({ id: 'db-task-1', status: 'open', chain_task_id: '1' })
    );
  });

  test('updates task status to in_review with challenge deadline', async () => {
    await handleAllSubmissionsRejected(makeEvent());
    expect(mockDb.updateTask).toHaveBeenCalledTimes(1);
    const updates = mockDb.updateTask.mock.calls[0][1];
    expect(updates.status).toBe('in_review');
    expect(updates.selected_at).toBeDefined();
    expect(updates.challenge_deadline).toBeDefined();
  });

  test('sets challenge deadline to 48 hours from now', async () => {
    const before = Date.now();
    await handleAllSubmissionsRejected(makeEvent());
    const after = Date.now();
    const updates = mockDb.updateTask.mock.calls[0][1];
    const deadline = new Date(updates.challenge_deadline).getTime();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    expect(deadline).toBeGreaterThanOrEqual(before + fortyEightHoursMs);
    expect(deadline).toBeLessThanOrEqual(after + fortyEightHoursMs);
  });

  test('throws when task is not found', async () => {
    mockDb.getTaskByChainId.mockImplementation(() => Promise.resolve(null));
    await expect(handleAllSubmissionsRejected(makeEvent())).rejects.toThrow(
      'not found in database'
    );
  });

  test('invalidates task and submission caches', async () => {
    await handleAllSubmissionsRejected(makeEvent());
    expect(mockCache.invalidateTaskCaches).toHaveBeenCalledWith('db-task-1');
    expect(mockCache.invalidateSubmissionCaches).toHaveBeenCalledWith('db-task-1');
  });
});
