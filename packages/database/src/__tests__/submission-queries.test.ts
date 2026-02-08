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
  getSubmissionsByTaskId,
  getSubmissionByTaskAndAgent,
  getWinningSubmission,
  getSubmissionsByAgent,
  createSubmission,
  markSubmissionAsWinner,
} = await import('../queries/submission-queries');

const mockSubmission = {
  id: 'sub-1',
  task_id: 'task-1',
  agent_address: '0xagent1',
  submission_index: 0,
  submission_cid: 'QmSub1',
  is_winner: false,
  ipfs_fetch_failed: false,
  submitted_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
};

describe('submission-queries', () => {
  beforeEach(() => {
    resetSupabaseClient();
    supabaseMock.reset();
    supabaseMock.setBuilder(createMockQueryBuilder([mockSubmission], null, 1));
  });

  describe('getSubmissionsByTaskId', () => {
    test('returns submissions for a task', async () => {
      const builder = createMockQueryBuilder([mockSubmission], null, 1);
      supabaseMock.setBuilder(builder);
      const result = await getSubmissionsByTaskId('task-1');
      expect(result.submissions).toEqual([mockSubmission]);
      expect(result.total).toBe(1);
      expect(builder.eq).toHaveBeenCalledWith('task_id', 'task-1');
    });

    test('applies pagination', async () => {
      const builder = createMockQueryBuilder([mockSubmission], null, 1);
      supabaseMock.setBuilder(builder);
      await getSubmissionsByTaskId('task-1', { limit: 10, offset: 5 });
      expect(builder.range).toHaveBeenCalledWith(5, 14);
    });

    test('orders by submission_index ascending', async () => {
      const builder = createMockQueryBuilder([mockSubmission], null, 1);
      supabaseMock.setBuilder(builder);
      await getSubmissionsByTaskId('task-1');
      expect(builder.order).toHaveBeenCalledWith('submission_index', { ascending: true });
    });

    test('uses default limit of 50', async () => {
      const builder = createMockQueryBuilder([mockSubmission], null, 1);
      supabaseMock.setBuilder(builder);
      await getSubmissionsByTaskId('task-1');
      expect(builder.range).toHaveBeenCalledWith(0, 49);
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }, null));
      await expect(getSubmissionsByTaskId('task-1')).rejects.toThrow(
        'Failed to get submissions: DB error'
      );
    });
  });

  describe('getSubmissionByTaskAndAgent', () => {
    test('returns submission when found', async () => {
      const builder = createMockQueryBuilder(mockSubmission);
      supabaseMock.setBuilder(builder);
      const result = await getSubmissionByTaskAndAgent('task-1', '0xAgent1');
      expect(result).toEqual(mockSubmission);
      expect(builder.eq).toHaveBeenCalledWith('task_id', 'task-1');
      expect(builder.eq).toHaveBeenCalledWith('agent_address', '0xagent1');
    });

    test('lowercases agent address', async () => {
      const builder = createMockQueryBuilder(mockSubmission);
      supabaseMock.setBuilder(builder);
      await getSubmissionByTaskAndAgent('task-1', '0xABCDEF');
      expect(builder.eq).toHaveBeenCalledWith('agent_address', '0xabcdef');
    });

    test('returns null when not found (PGRST116)', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await getSubmissionByTaskAndAgent('task-1', '0xagent');
      expect(result).toBeNull();
    });

    test('throws on other errors', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { code: 'OTHER', message: 'DB error' }));
      await expect(getSubmissionByTaskAndAgent('task-1', '0xagent')).rejects.toThrow(
        'Failed to get submission'
      );
    });
  });

  describe('getWinningSubmission', () => {
    test('returns winning submission', async () => {
      const winner = { ...mockSubmission, is_winner: true };
      const builder = createMockQueryBuilder(winner);
      supabaseMock.setBuilder(builder);
      const result = await getWinningSubmission('task-1');
      expect(result).toEqual(winner);
      expect(builder.eq).toHaveBeenCalledWith('task_id', 'task-1');
      expect(builder.eq).toHaveBeenCalledWith('is_winner', true);
    });

    test('returns null when no winner (PGRST116)', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await getWinningSubmission('task-1');
      expect(result).toBeNull();
    });

    test('throws on other errors', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { code: 'OTHER', message: 'DB error' }));
      await expect(getWinningSubmission('task-1')).rejects.toThrow(
        'Failed to get winning submission'
      );
    });
  });

  describe('getSubmissionsByAgent', () => {
    test('returns submissions by agent', async () => {
      const builder = createMockQueryBuilder([mockSubmission], null, 1);
      supabaseMock.setBuilder(builder);
      const result = await getSubmissionsByAgent('0xAgent1');
      expect(result.submissions).toEqual([mockSubmission]);
      expect(builder.eq).toHaveBeenCalledWith('agent_address', '0xagent1');
    });

    test('applies pagination', async () => {
      const builder = createMockQueryBuilder([mockSubmission], null, 1);
      supabaseMock.setBuilder(builder);
      await getSubmissionsByAgent('0xagent', { limit: 5, offset: 10 });
      expect(builder.range).toHaveBeenCalledWith(10, 14);
    });

    test('orders by submitted_at descending', async () => {
      const builder = createMockQueryBuilder([mockSubmission], null, 1);
      supabaseMock.setBuilder(builder);
      await getSubmissionsByAgent('0xagent');
      expect(builder.order).toHaveBeenCalledWith('submitted_at', { ascending: false });
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }, null));
      await expect(getSubmissionsByAgent('0xagent')).rejects.toThrow('Failed to get submissions');
    });
  });

  describe('createSubmission', () => {
    test('creates and returns submission', async () => {
      const builder = createMockQueryBuilder(mockSubmission);
      supabaseMock.setBuilder(builder);
      const input = {
        task_id: 'task-1',
        agent_address: '0xAgent1',
        submission_index: 0,
        specification_cid: 'QmSub1',
        tx_hash: '0xhash',
      };
      const result = await createSubmission(input as any);
      expect(result).toEqual(mockSubmission);
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ agent_address: '0xagent1' })
      );
    });

    test('lowercases agent address on insert', async () => {
      const builder = createMockQueryBuilder(mockSubmission);
      supabaseMock.setBuilder(builder);
      await createSubmission({ agent_address: '0xABC', task_id: 'task-1' } as any);
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ agent_address: '0xabc' })
      );
    });

    test('throws on insert error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'Unique violation' }));
      await expect(
        createSubmission({ agent_address: '0xfail', task_id: 'task-1' } as any)
      ).rejects.toThrow('Failed to create submission');
    });
  });

  describe('markSubmissionAsWinner', () => {
    test('uses RPC when available', async () => {
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: null, error: null }));
      const builder = createMockQueryBuilder(mockSubmission);
      supabaseMock.setBuilder(builder);
      await markSubmissionAsWinner('task-1', '0xAgent1');
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith('mark_submission_winner', {
        p_task_id: 'task-1',
        p_agent_address: '0xagent1',
      });
    });

    test('falls back when RPC function missing (42883)', async () => {
      supabaseMock.setRpcHandler(() =>
        Promise.resolve({ data: null, error: { code: '42883', message: 'function not found' } })
      );
      const builder = createMockQueryBuilder(mockSubmission);
      supabaseMock.setBuilder(builder);
      const result = await markSubmissionAsWinner('task-1', '0xAgent1');
      expect(result).toEqual(mockSubmission);
    });

    test('throws on other RPC errors', async () => {
      supabaseMock.setRpcHandler(() =>
        Promise.resolve({ data: null, error: { code: 'OTHER', message: 'RPC error' } })
      );
      await expect(markSubmissionAsWinner('task-1', '0xagent')).rejects.toThrow(
        'Failed to mark winner'
      );
    });

    test('lowercases address', async () => {
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: null, error: null }));
      const builder = createMockQueryBuilder(mockSubmission);
      supabaseMock.setBuilder(builder);
      await markSubmissionAsWinner('task-1', '0xABCDEF');
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith('mark_submission_winner', {
        p_task_id: 'task-1',
        p_agent_address: '0xabcdef',
      });
    });
  });
});
