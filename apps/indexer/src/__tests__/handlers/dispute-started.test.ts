import { describe, test, expect, mock, beforeEach } from 'bun:test';

const mockGetTaskByChainId = mock(() => Promise.resolve({ id: 'db-task-1' }));
const mockCreateDispute = mock(() => Promise.resolve({ id: 'dispute-1' }));
const mockInvalidateDisputeCaches = mock(() => Promise.resolve());
const mockInvalidateTaskCaches = mock(() => Promise.resolve());

mock.module('@clawboy/database', () => ({
  getTaskByChainId: mockGetTaskByChainId,
  createDispute: mockCreateDispute,
}));
mock.module('@clawboy/cache', () => ({
  invalidateDisputeCaches: mockInvalidateDisputeCaches,
  invalidateTaskCaches: mockInvalidateTaskCaches,
}));

import { handleDisputeCreated } from '../../handlers/dispute-started';
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'DisputeCreated',
    chainId: 84532,
    blockNumber: 1100n,
    transactionHash: '0xdisputecreated',
    logIndex: 0,
    args: {
      disputeId: 10n,
      taskId: 1n,
      disputer: '0xDisputer',
      stake: 500n,
      votingDeadline: 1700259200n,
      ...overrides,
    },
  };
}

describe('handleDisputeCreated', () => {
  beforeEach(() => {
    mockGetTaskByChainId.mockClear();
    mockCreateDispute.mockClear();
    mockInvalidateDisputeCaches.mockClear();
    mockInvalidateTaskCaches.mockClear();
    mockGetTaskByChainId.mockImplementation(() => Promise.resolve({ id: 'db-task-1' }));
  });

  test('creates dispute record with correct fields', async () => {
    await handleDisputeCreated(makeEvent());
    expect(mockCreateDispute).toHaveBeenCalledTimes(1);
    const arg = (mockCreateDispute.mock.calls[0] as any[])[0];
    expect(arg.task_id).toBe('db-task-1');
    expect(arg.chain_dispute_id).toBe('10');
    expect(arg.disputer_address).toBe('0xdisputer');
    expect(arg.dispute_stake).toBe('500');
    expect(arg.status).toBe('active');
    expect(arg.tx_hash).toBe('0xdisputecreated');
  });

  test('converts voting deadline from unix timestamp', async () => {
    await handleDisputeCreated(makeEvent({ votingDeadline: 1700259200n }));
    const arg = (mockCreateDispute.mock.calls[0] as any[])[0];
    expect(arg.voting_deadline).toBe(new Date(1700259200 * 1000).toISOString());
  });

  test('throws when task is not found', async () => {
    mockGetTaskByChainId.mockImplementation((() => Promise.resolve(null)) as any);
    await expect(handleDisputeCreated(makeEvent())).rejects.toThrow('not found in database');
  });

  test('invalidates dispute and task caches', async () => {
    await handleDisputeCreated(makeEvent());
    expect(mockInvalidateDisputeCaches).toHaveBeenCalledWith(undefined, 'db-task-1');
    expect(mockInvalidateTaskCaches).toHaveBeenCalledWith('db-task-1');
  });
});
