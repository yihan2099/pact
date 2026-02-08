import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase, createMockCache } from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockCache = createMockCache();

mockDb.setupMock();
mockCache.setupMock();

const { handleVoteSubmitted } = await import('../../handlers/vote-submitted');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'VoteSubmitted',
    chainId: 84532,
    blockNumber: 1200n,
    transactionHash: '0xvote',
    logIndex: 0,
    args: {
      disputeId: 10n,
      voter: '0xVoter',
      supportsDisputer: true,
      weight: 100n,
      ...overrides,
    },
  };
}

describe('handleVoteSubmitted', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockCache.resetAll();
    mockDb.getDisputeByChainId.mockImplementation(() => Promise.resolve({ id: 'db-dispute-1' }));
  });

  test('creates vote record with correct fields', async () => {
    await handleVoteSubmitted(makeEvent());
    expect(mockDb.createDisputeVote).toHaveBeenCalledTimes(1);
    const arg = mockDb.createDisputeVote.mock.calls[0][0];
    expect(arg.dispute_id).toBe('db-dispute-1');
    expect(arg.voter_address).toBe('0xvoter');
    expect(arg.supports_disputer).toBe(true);
    expect(arg.vote_weight).toBe('100');
    expect(arg.tx_hash).toBe('0xvote');
  });

  test('handles vote against disputer', async () => {
    await handleVoteSubmitted(makeEvent({ supportsDisputer: false }));
    const arg = mockDb.createDisputeVote.mock.calls[0][0];
    expect(arg.supports_disputer).toBe(false);
  });

  test('throws when dispute is not found', async () => {
    mockDb.getDisputeByChainId.mockImplementation(() => Promise.resolve(null));
    await expect(handleVoteSubmitted(makeEvent())).rejects.toThrow('not found in database');
  });

  test('invalidates dispute caches', async () => {
    await handleVoteSubmitted(makeEvent());
    expect(mockCache.invalidateDisputeCaches).toHaveBeenCalledWith('db-dispute-1');
  });
});
