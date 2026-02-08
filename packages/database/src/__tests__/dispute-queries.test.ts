import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockQueryBuilder, setupSupabaseMock } from './helpers/mock-supabase';

// Set env vars BEFORE any imports
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-anon-key';
process.env.SUPABASE_SECRET_KEY = 'test-service-role-key';

// Setup mock BEFORE importing source modules
const supabaseMock = setupSupabaseMock();

// Now import real modules
const { resetSupabaseClient } = await import('../client');
const {
  getDisputeById,
  getDisputeByChainId,
  getDisputeByTaskId,
  listActiveDisputes,
  getDisputesReadyForResolution,
  createDispute,
  updateDispute,
  getDisputeVotes,
  getDisputeVote,
  hasVoted,
  createDisputeVote,
  getVotesByVoter,
} = await import('../queries/dispute-queries');

const mockDispute = {
  id: 'dispute-1',
  chain_dispute_id: '1',
  task_id: 'task-1',
  disputer_address: '0xdisputer1',
  dispute_stake: '100000000000000000',
  voting_deadline: '2025-02-01T00:00:00Z',
  status: 'active',
  disputer_won: null as boolean | null,
  votes_for_disputer: '0',
  votes_against_disputer: '0',
  tx_hash: '0xhash',
  created_at: '2025-01-01T00:00:00Z',
  resolved_at: null as string | null,
};

const mockVote = {
  id: 'vote-1',
  dispute_id: 'dispute-1',
  voter_address: '0xvoter1',
  supports_disputer: true,
  vote_weight: '5',
  tx_hash: '0xvotehash',
  voted_at: '2025-01-15T00:00:00Z',
  created_at: '2025-01-15T00:00:00Z',
};

describe('dispute-queries', () => {
  beforeEach(() => {
    resetSupabaseClient();
    supabaseMock.reset();
    supabaseMock.setBuilder(createMockQueryBuilder(mockDispute));
  });

  describe('getDisputeById', () => {
    test('returns dispute when found', async () => {
      const builder = createMockQueryBuilder(mockDispute);
      supabaseMock.setBuilder(builder);
      const result = await getDisputeById('dispute-1');
      expect(result).toEqual(mockDispute);
      expect(supabaseMock.mockFrom).toHaveBeenCalledWith('disputes');
      expect(builder.eq).toHaveBeenCalledWith('id', 'dispute-1');
      expect(builder.single).toHaveBeenCalled();
    });

    test('returns null when not found (PGRST116)', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await getDisputeById('nonexistent');
      expect(result).toBeNull();
    });

    test('throws on other errors', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { code: 'OTHER', message: 'DB error' }));
      await expect(getDisputeById('dispute-1')).rejects.toThrow('Failed to get dispute: DB error');
    });
  });

  describe('getDisputeByChainId', () => {
    test('returns dispute by chain dispute ID', async () => {
      const builder = createMockQueryBuilder(mockDispute);
      supabaseMock.setBuilder(builder);
      const result = await getDisputeByChainId('1');
      expect(result).toEqual(mockDispute);
      expect(builder.eq).toHaveBeenCalledWith('chain_dispute_id', '1');
    });

    test('returns null when not found', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await getDisputeByChainId('999');
      expect(result).toBeNull();
    });

    test('throws on other errors', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { code: 'OTHER', message: 'DB error' }));
      await expect(getDisputeByChainId('1')).rejects.toThrow('Failed to get dispute');
    });
  });

  describe('getDisputeByTaskId', () => {
    test('returns dispute for task', async () => {
      const builder = createMockQueryBuilder(mockDispute);
      supabaseMock.setBuilder(builder);
      const result = await getDisputeByTaskId('task-1');
      expect(result).toEqual(mockDispute);
      expect(builder.eq).toHaveBeenCalledWith('task_id', 'task-1');
    });

    test('returns null when no dispute for task', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await getDisputeByTaskId('task-no-dispute');
      expect(result).toBeNull();
    });
  });

  describe('listActiveDisputes', () => {
    test('returns active disputes with defaults', async () => {
      const builder = createMockQueryBuilder([mockDispute], null, 1);
      supabaseMock.setBuilder(builder);
      const result = await listActiveDisputes();
      expect(result.disputes).toEqual([mockDispute]);
      expect(result.total).toBe(1);
      expect(builder.eq).toHaveBeenCalledWith('status', 'active');
    });

    test('orders by voting_deadline ascending', async () => {
      const builder = createMockQueryBuilder([mockDispute], null, 1);
      supabaseMock.setBuilder(builder);
      await listActiveDisputes();
      expect(builder.order).toHaveBeenCalledWith('voting_deadline', { ascending: true });
    });

    test('applies pagination', async () => {
      const builder = createMockQueryBuilder([mockDispute], null, 1);
      supabaseMock.setBuilder(builder);
      await listActiveDisputes({ limit: 10, offset: 5 });
      expect(builder.range).toHaveBeenCalledWith(5, 14);
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }, null));
      await expect(listActiveDisputes()).rejects.toThrow('Failed to list disputes');
    });
  });

  describe('getDisputesReadyForResolution', () => {
    test('queries disputes past voting deadline', async () => {
      const builder = createMockQueryBuilder([mockDispute]);
      supabaseMock.setBuilder(builder);
      await getDisputesReadyForResolution();
      expect(builder.eq).toHaveBeenCalledWith('status', 'active');
      expect(builder.lte).toHaveBeenCalledWith('voting_deadline', expect.any(String));
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(getDisputesReadyForResolution()).rejects.toThrow(
        'Failed to get disputes ready for resolution'
      );
    });
  });

  describe('createDispute', () => {
    test('creates and returns dispute', async () => {
      const builder = createMockQueryBuilder(mockDispute);
      supabaseMock.setBuilder(builder);
      const input = {
        task_id: 'task-1',
        disputer_address: '0xDISPUTER1',
        chain_dispute_id: '1',
        dispute_stake: '100000000000000000',
        voting_deadline: '2025-02-01T00:00:00Z',
        tx_hash: '0xhash',
      };
      const result = await createDispute(input as any);
      expect(result).toEqual(mockDispute);
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ disputer_address: '0xdisputer1' })
      );
    });

    test('lowercases disputer address', async () => {
      const builder = createMockQueryBuilder(mockDispute);
      supabaseMock.setBuilder(builder);
      await createDispute({ disputer_address: '0xABC' } as any);
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ disputer_address: '0xabc' })
      );
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'Duplicate' }));
      await expect(createDispute({ disputer_address: '0x1' } as any)).rejects.toThrow(
        'Failed to create dispute'
      );
    });
  });

  describe('updateDispute', () => {
    test('updates and returns dispute', async () => {
      const builder = createMockQueryBuilder(mockDispute);
      supabaseMock.setBuilder(builder);
      const result = await updateDispute('dispute-1', { status: 'resolved' } as any);
      expect(result).toEqual(mockDispute);
      expect(builder.eq).toHaveBeenCalledWith('id', 'dispute-1');
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(updateDispute('dispute-1', {} as any)).rejects.toThrow(
        'Failed to update dispute'
      );
    });
  });

  describe('getDisputeVotes', () => {
    test('returns votes for a dispute', async () => {
      const builder = createMockQueryBuilder([mockVote]);
      supabaseMock.setBuilder(builder);
      const result = await getDisputeVotes('dispute-1');
      expect(result).toEqual([mockVote]);
      expect(supabaseMock.mockFrom).toHaveBeenCalledWith('dispute_votes');
      expect(builder.eq).toHaveBeenCalledWith('dispute_id', 'dispute-1');
    });

    test('orders by voted_at ascending', async () => {
      const builder = createMockQueryBuilder([mockVote]);
      supabaseMock.setBuilder(builder);
      await getDisputeVotes('dispute-1');
      expect(builder.order).toHaveBeenCalledWith('voted_at', { ascending: true });
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(getDisputeVotes('dispute-1')).rejects.toThrow('Failed to get dispute votes');
    });
  });

  describe('getDisputeVote', () => {
    test('returns vote when found', async () => {
      const builder = createMockQueryBuilder(mockVote);
      supabaseMock.setBuilder(builder);
      const result = await getDisputeVote('dispute-1', '0xVoter1');
      expect(result).toEqual(mockVote);
      expect(builder.eq).toHaveBeenCalledWith('voter_address', '0xvoter1');
    });

    test('returns null when not found', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await getDisputeVote('dispute-1', '0xvoter');
      expect(result).toBeNull();
    });
  });

  describe('hasVoted', () => {
    test('returns true when vote exists', async () => {
      const builder = createMockQueryBuilder(mockVote);
      supabaseMock.setBuilder(builder);
      const result = await hasVoted('dispute-1', '0xvoter1');
      expect(result).toBe(true);
    });

    test('returns false when no vote', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await hasVoted('dispute-1', '0xvoter');
      expect(result).toBe(false);
    });
  });

  describe('createDisputeVote', () => {
    test('creates and returns vote', async () => {
      const builder = createMockQueryBuilder(mockVote);
      supabaseMock.setBuilder(builder);
      const input = {
        dispute_id: 'dispute-1',
        voter_address: '0xVOTER1',
        supports_disputer: true,
        vote_weight: '5',
      };
      const result = await createDisputeVote(input as any);
      expect(result).toEqual(mockVote);
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ voter_address: '0xvoter1' })
      );
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(createDisputeVote({ voter_address: '0x1' } as any)).rejects.toThrow(
        'Failed to create dispute vote'
      );
    });
  });

  describe('getVotesByVoter', () => {
    test('returns votes with pagination', async () => {
      const builder = createMockQueryBuilder([mockVote], null, 1);
      supabaseMock.setBuilder(builder);
      const result = await getVotesByVoter('0xVoter1');
      expect(result.votes).toEqual([mockVote]);
      expect(result.total).toBe(1);
      expect(builder.eq).toHaveBeenCalledWith('voter_address', '0xvoter1');
    });

    test('applies pagination', async () => {
      const builder = createMockQueryBuilder([mockVote], null, 1);
      supabaseMock.setBuilder(builder);
      await getVotesByVoter('0xvoter', { limit: 5, offset: 10 });
      expect(builder.range).toHaveBeenCalledWith(10, 14);
    });
  });
});
