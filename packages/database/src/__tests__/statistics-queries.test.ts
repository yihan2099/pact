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
const { getPlatformStatistics, getTagStatistics, getBountyStatistics } =
  await import('../queries/statistics-queries');

describe('statistics-queries', () => {
  beforeEach(() => {
    resetSupabaseClient();
    supabaseMock.reset();
  });

  describe('getPlatformStatistics', () => {
    test('returns aggregated statistics', async () => {
      // getPlatformStatistics calls from() with multiple tables and rpc() with multiple functions.
      // We need a from() mock that returns different builders per table,
      // and an rpc() mock that returns different results per function name.
      const mockFromResults = new Map<string, any>();
      const mockRpcResults = new Map<string, any>();

      mockFromResults.set('tasks', createMockQueryBuilder(null, null, 10));
      mockFromResults.set('agents', createMockQueryBuilder(null, null, 20));
      mockFromResults.set('submissions', createMockQueryBuilder(null, null, 15));
      mockFromResults.set('disputes', createMockQueryBuilder(null, null, 2));

      mockRpcResults.set('sum_completed_bounties', { data: '5000000000000000000', error: null });
      mockRpcResults.set('sum_open_bounties', { data: '3000000000000000000', error: null });

      supabaseMock.mockFrom.mockImplementation((table: string) => {
        return mockFromResults.get(table) || createMockQueryBuilder(null, null, 0);
      });
      supabaseMock.mockRpc.mockImplementation((fnName: string) => {
        const result = mockRpcResults.get(fnName);
        return result ? Promise.resolve(result) : Promise.resolve({ data: null, error: null });
      });

      const result = await getPlatformStatistics();
      expect(result).toHaveProperty('totalTasks');
      expect(result).toHaveProperty('openTasks');
      expect(result).toHaveProperty('completedTasks');
      expect(result).toHaveProperty('bountyDistributed');
      expect(result).toHaveProperty('bountyAvailable');
      expect(result).toHaveProperty('registeredAgents');
      expect(result).toHaveProperty('totalSubmissions');
      expect(result).toHaveProperty('activeDisputes');
      expect(result).toHaveProperty('avgCompletionHours');
    });

    test('calculates average completion hours', async () => {
      const now = new Date();
      const created = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago
      const completedTasks = [
        { created_at: created.toISOString(), selected_at: now.toISOString() },
      ];
      const completedTasksBuilder = createMockQueryBuilder(completedTasks, null, 1);

      supabaseMock.mockFrom.mockImplementation((table: string) => {
        if (table === 'tasks') return completedTasksBuilder;
        return createMockQueryBuilder(null, null, 0);
      });
      supabaseMock.mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'sum_completed_bounties') return Promise.resolve({ data: '0', error: null });
        if (fnName === 'sum_open_bounties') return Promise.resolve({ data: '0', error: null });
        return Promise.resolve({ data: null, error: null });
      });

      const result = await getPlatformStatistics();
      expect(result.avgCompletionHours).toBeCloseTo(48, 0);
    });
  });

  describe('getTagStatistics', () => {
    test('aggregates tags from tasks', async () => {
      const tasksWithTags = [
        { tags: ['solidity', 'audit'] },
        { tags: ['solidity', 'typescript'] },
        { tags: ['typescript'] },
      ];
      supabaseMock.setBuilder(createMockQueryBuilder(tasksWithTags));

      const result = await getTagStatistics();
      expect(result).toBeInstanceOf(Array);

      const solidityTag = result.find((t) => t.tag === 'solidity');
      expect(solidityTag?.count).toBe(2);

      const typescriptTag = result.find((t) => t.tag === 'typescript');
      expect(typescriptTag?.count).toBe(2);
    });

    test('returns top N tags by count', async () => {
      const tasksWithTags = [{ tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, { tags: ['a', 'b'] }];
      supabaseMock.setBuilder(createMockQueryBuilder(tasksWithTags));

      const result = await getTagStatistics(3);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    test('handles tasks with no tags', async () => {
      const tasks = [{ tags: null }, { tags: ['solidity'] }];
      supabaseMock.setBuilder(createMockQueryBuilder(tasks));

      const result = await getTagStatistics();
      expect(result).toEqual([{ tag: 'solidity', count: 1 }]);
    });

    test('returns empty array when no tasks have tags', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder([]));
      const result = await getTagStatistics();
      expect(result).toEqual([]);
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(getTagStatistics()).rejects.toThrow('Failed to get tag statistics');
    });
  });

  describe('getBountyStatistics', () => {
    test('returns min, max, avg bounties', async () => {
      const tasks = [
        { bounty_amount: '1000000000000000000' },
        { bounty_amount: '2000000000000000000' },
        { bounty_amount: '3000000000000000000' },
      ];
      supabaseMock.setBuilder(createMockQueryBuilder(tasks));

      const result = await getBountyStatistics();
      expect(result.minBounty).toBe('1000000000000000000');
      expect(result.maxBounty).toBe('3000000000000000000');
      expect(result.avgBounty).toBe('2000000000000000000');
    });

    test('returns zeros when no tasks exist', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder([]));
      const result = await getBountyStatistics();
      expect(result).toEqual({ minBounty: '0', maxBounty: '0', avgBounty: '0' });
    });

    test('returns zeros when data is null', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null));
      const result = await getBountyStatistics();
      expect(result).toEqual({ minBounty: '0', maxBounty: '0', avgBounty: '0' });
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(getBountyStatistics()).rejects.toThrow('Failed to get bounty statistics');
    });
  });
});
