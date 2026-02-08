import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase, createMockCache } from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockCache = createMockCache();

mockDb.setupMock();
mockCache.setupMock();

const { handleDisputeResolved } = await import('../../handlers/dispute-resolved');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'DisputeResolved',
    chainId: 84532,
    blockNumber: 1300n,
    transactionHash: '0xresolved',
    logIndex: 0,
    args: {
      disputeId: 10n,
      taskId: 1n,
      disputerWon: true,
      votesFor: 300n,
      votesAgainst: 100n,
      ...overrides,
    },
  };
}

describe('handleDisputeResolved', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockCache.resetAll();
    mockDb.getDisputeByChainId.mockImplementation(() =>
      Promise.resolve({ id: 'db-dispute-1', disputer_address: '0xdisputer' })
    );
  });

  test('updates dispute as resolved with vote counts', async () => {
    await handleDisputeResolved(makeEvent());
    expect(mockDb.updateDispute).toHaveBeenCalledTimes(1);
    const [id, updates] = mockDb.updateDispute.mock.calls[0];
    expect(id).toBe('db-dispute-1');
    expect(updates.status).toBe('resolved');
    expect(updates.disputer_won).toBe(true);
    expect(updates.votes_for_disputer).toBe('300');
    expect(updates.votes_against_disputer).toBe('100');
    expect(updates.resolved_at).toBeDefined();
  });

  test('increments disputes_won when disputer wins', async () => {
    await handleDisputeResolved(makeEvent({ disputerWon: true }));
    expect(mockDb.incrementDisputesWon).toHaveBeenCalledWith('0xdisputer');
    expect(mockDb.incrementDisputesLost).not.toHaveBeenCalled();
  });

  test('increments disputes_lost when disputer loses', async () => {
    await handleDisputeResolved(makeEvent({ disputerWon: false }));
    expect(mockDb.incrementDisputesLost).toHaveBeenCalledWith('0xdisputer');
    expect(mockDb.incrementDisputesWon).not.toHaveBeenCalled();
  });

  test('throws when dispute is not found', async () => {
    mockDb.getDisputeByChainId.mockImplementation(() => Promise.resolve(null));
    await expect(handleDisputeResolved(makeEvent())).rejects.toThrow('not found in database');
  });

  test('does not fail if reputation update throws', async () => {
    mockDb.incrementDisputesWon.mockImplementation(() =>
      Promise.reject(new Error('agent not found'))
    );
    await expect(handleDisputeResolved(makeEvent())).resolves.toBeUndefined();
  });

  test('invalidates dispute and agent caches', async () => {
    await handleDisputeResolved(makeEvent());
    expect(mockCache.invalidateDisputeCaches).toHaveBeenCalledWith('db-dispute-1');
    expect(mockCache.invalidateAgentCaches).toHaveBeenCalledWith('0xdisputer');
  });
});
