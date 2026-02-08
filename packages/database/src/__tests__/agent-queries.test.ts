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
  listAgents,
  getAgentByAddress,
  upsertAgent,
  updateAgent,
  incrementTasksWon,
  calculateVoteWeight,
  getAgentsWithFailedIpfs,
} = await import('../queries/agent-queries');

const mockAgent = {
  id: 'agent-1',
  address: '0xagent1',
  agent_id: null as string | null,
  agent_uri: null as string | null,
  name: 'Test Agent',
  description: 'A test agent',
  skills: ['solidity', 'typescript'],
  is_active: true,
  reputation: '100',
  tasks_won: 5,
  disputes_won: 0,
  disputes_lost: 0,
  profile_cid: 'QmProfile1',
  ipfs_fetch_failed: false,
  webhook_url: null as string | null,
  webhook_secret: null as string | null,
  registered_at: '2025-01-01T00:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('agent-queries', () => {
  beforeEach(() => {
    resetSupabaseClient();
    supabaseMock.reset();
    supabaseMock.setBuilder(createMockQueryBuilder([mockAgent], null, 1));
  });

  describe('listAgents', () => {
    test('returns agents with defaults', async () => {
      const builder = createMockQueryBuilder([mockAgent], null, 1);
      supabaseMock.setBuilder(builder);
      const result = await listAgents();
      expect(result.agents).toEqual([mockAgent]);
      expect(result.total).toBe(1);
      expect(supabaseMock.mockFrom).toHaveBeenCalledWith('agents');
    });

    test('applies skills filter with overlaps', async () => {
      const builder = createMockQueryBuilder([mockAgent], null, 1);
      supabaseMock.setBuilder(builder);
      await listAgents({ skills: ['solidity'] });
      expect(builder.overlaps).toHaveBeenCalledWith('skills', ['solidity']);
    });

    test('applies isActive filter', async () => {
      const builder = createMockQueryBuilder([mockAgent], null, 1);
      supabaseMock.setBuilder(builder);
      await listAgents({ isActive: true });
      expect(builder.eq).toHaveBeenCalledWith('is_active', true);
    });

    test('applies minReputation filter', async () => {
      const builder = createMockQueryBuilder([mockAgent], null, 1);
      supabaseMock.setBuilder(builder);
      await listAgents({ minReputation: 50 });
      expect(builder.gte).toHaveBeenCalledWith('reputation', '50');
    });

    test('applies sorting', async () => {
      const builder = createMockQueryBuilder([mockAgent], null, 1);
      supabaseMock.setBuilder(builder);
      await listAgents({ sortBy: 'tasks_won', sortOrder: 'asc' });
      expect(builder.order).toHaveBeenCalledWith('tasks_won', { ascending: true });
    });

    test('applies pagination', async () => {
      const builder = createMockQueryBuilder([mockAgent], null, 1);
      supabaseMock.setBuilder(builder);
      await listAgents({ limit: 10, offset: 20 });
      expect(builder.range).toHaveBeenCalledWith(20, 29);
    });

    test('defaults to reputation desc sort', async () => {
      const builder = createMockQueryBuilder([mockAgent], null, 1);
      supabaseMock.setBuilder(builder);
      await listAgents();
      expect(builder.order).toHaveBeenCalledWith('reputation', { ascending: false });
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }, null));
      await expect(listAgents()).rejects.toThrow('Failed to list agents: DB error');
    });
  });

  describe('getAgentByAddress', () => {
    test('returns agent when found', async () => {
      const builder = createMockQueryBuilder(mockAgent);
      supabaseMock.setBuilder(builder);
      const result = await getAgentByAddress('0xAgent1');
      expect(result).toEqual(mockAgent);
      expect(builder.eq).toHaveBeenCalledWith('address', '0xagent1');
    });

    test('lowercases address', async () => {
      const builder = createMockQueryBuilder(mockAgent);
      supabaseMock.setBuilder(builder);
      await getAgentByAddress('0xABCDEF');
      expect(builder.eq).toHaveBeenCalledWith('address', '0xabcdef');
    });

    test('returns null when not found (PGRST116)', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await getAgentByAddress('0xnonexistent');
      expect(result).toBeNull();
    });

    test('throws on other errors', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { code: 'OTHER', message: 'DB error' }));
      await expect(getAgentByAddress('0xagent')).rejects.toThrow('Failed to get agent');
    });
  });

  describe('upsertAgent', () => {
    test('upserts and returns agent', async () => {
      const builder = createMockQueryBuilder(mockAgent);
      supabaseMock.setBuilder(builder);
      const input = { address: '0xAGENT1', name: 'Agent' };
      const result = await upsertAgent(input as any);
      expect(result).toEqual(mockAgent);
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ address: '0xagent1' }),
        { onConflict: 'address' }
      );
    });

    test('lowercases address on upsert', async () => {
      const builder = createMockQueryBuilder(mockAgent);
      supabaseMock.setBuilder(builder);
      await upsertAgent({ address: '0xABC' } as any);
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ address: '0xabc' }),
        expect.anything()
      );
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(upsertAgent({ address: '0xabc' } as any)).rejects.toThrow(
        'Failed to upsert agent'
      );
    });
  });

  describe('updateAgent', () => {
    test('updates and returns agent', async () => {
      const builder = createMockQueryBuilder(mockAgent);
      supabaseMock.setBuilder(builder);
      const result = await updateAgent('0xAgent1', { name: 'Updated' } as any);
      expect(result).toEqual(mockAgent);
      expect(builder.eq).toHaveBeenCalledWith('address', '0xagent1');
    });

    test('adds updated_at timestamp', async () => {
      const builder = createMockQueryBuilder(mockAgent);
      supabaseMock.setBuilder(builder);
      await updateAgent('0xagent', { name: 'Updated' } as any);
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ updated_at: expect.any(String) })
      );
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(updateAgent('0xagent', {} as any)).rejects.toThrow('Failed to update agent');
    });
  });

  describe('incrementTasksWon', () => {
    test('calls RPC with lowercase address', async () => {
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: null, error: null }));
      await incrementTasksWon('0xAGENT1');
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith('increment_tasks_won', {
        agent_addr: '0xagent1',
      });
    });

    test('throws on RPC error', async () => {
      supabaseMock.setRpcHandler(() =>
        Promise.resolve({ data: null, error: { message: 'RPC error' } })
      );
      await expect(incrementTasksWon('0xagent')).rejects.toThrow('Failed to increment tasks won');
    });
  });

  describe('calculateVoteWeight', () => {
    test('returns 1 for zero reputation', () => {
      expect(calculateVoteWeight(0)).toBe(1);
    });

    test('returns 1 for negative reputation', () => {
      expect(calculateVoteWeight(-5)).toBe(1);
    });

    test('calculates log2 for positive reputation', () => {
      expect(calculateVoteWeight(7)).toBe(3); // log2(8) = 3
      expect(calculateVoteWeight(15)).toBe(4); // log2(16) = 4
    });

    test('accepts string reputation', () => {
      expect(calculateVoteWeight('100')).toBe(6); // floor(log2(101)) = 6
    });
  });

  describe('getAgentsWithFailedIpfs', () => {
    test('queries agents with ipfs_fetch_failed=true', async () => {
      const builder = createMockQueryBuilder([mockAgent]);
      supabaseMock.setBuilder(builder);
      await getAgentsWithFailedIpfs();
      expect(builder.eq).toHaveBeenCalledWith('ipfs_fetch_failed', true);
      expect(builder.limit).toHaveBeenCalledWith(50);
    });
  });
});
