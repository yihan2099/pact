import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockQueryBuilder, setupSupabaseMock } from './helpers/mock-supabase';

// Set env vars BEFORE any imports
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-anon-key';
process.env.SUPABASE_SECRET_KEY = 'test-service-role-key';

// Setup mock BEFORE importing source modules
const supabaseMock = setupSupabaseMock();

// Now import real modules - they'll use the mocked createClient
const { resetSupabaseClient } = await import('../client');
const {
  listTasks,
  getTaskById,
  getTaskByChainId,
  createTask,
  updateTask,
  getTasksWithFailedIpfs,
  getTasksInReview,
  getTasksReadyForFinalization,
} = await import('../queries/task-queries');

const mockTask = {
  id: 'task-1',
  chain_id: 84532,
  chain_task_id: '1',
  title: 'Test Task',
  description: 'A test task',
  status: 'open',
  bounty_amount: '1000000000000000000',
  bounty_token: '0x0000000000000000000000000000000000000000',
  creator_address: '0xabc123',
  winner_address: null as string | null,
  specification_cid: 'QmTest123',
  tags: ['solidity', 'audit'],
  deadline: null as string | null,
  selected_at: null as string | null,
  challenge_deadline: null as string | null,
  submission_count: 0,
  ipfs_fetch_failed: false,
  created_at_block: '100',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('task-queries', () => {
  beforeEach(() => {
    resetSupabaseClient();
    supabaseMock.reset();
    supabaseMock.setBuilder(createMockQueryBuilder([mockTask], null, 1));
  });

  describe('listTasks', () => {
    test('returns tasks with defaults', async () => {
      const result = await listTasks();
      expect(result).toEqual({ tasks: [mockTask], total: 1 });
      expect(supabaseMock.mockFrom).toHaveBeenCalledWith('tasks');
    });

    test('applies status filter', async () => {
      const builder = createMockQueryBuilder([mockTask], null, 1);
      supabaseMock.setBuilder(builder);
      await listTasks({ status: 'open' as any });
      expect(builder.eq).toHaveBeenCalledWith('status', 'open');
    });

    test('applies creatorAddress filter with lowercase', async () => {
      const builder = createMockQueryBuilder([mockTask], null, 1);
      supabaseMock.setBuilder(builder);
      await listTasks({ creatorAddress: '0xABC123' });
      expect(builder.eq).toHaveBeenCalledWith('creator_address', '0xabc123');
    });

    test('applies winnerAddress filter with lowercase', async () => {
      const builder = createMockQueryBuilder([mockTask], null, 1);
      supabaseMock.setBuilder(builder);
      await listTasks({ winnerAddress: '0xDEF456' });
      expect(builder.eq).toHaveBeenCalledWith('winner_address', '0xdef456');
    });

    test('applies tags filter with overlaps', async () => {
      const builder = createMockQueryBuilder([mockTask], null, 1);
      supabaseMock.setBuilder(builder);
      await listTasks({ tags: ['solidity'] });
      expect(builder.overlaps).toHaveBeenCalledWith('tags', ['solidity']);
    });

    test('applies bountyToken filter with lowercase', async () => {
      const builder = createMockQueryBuilder([mockTask], null, 1);
      supabaseMock.setBuilder(builder);
      await listTasks({ bountyToken: '0xABC' });
      expect(builder.eq).toHaveBeenCalledWith('bounty_token', '0xabc');
    });

    test('applies sorting', async () => {
      const builder = createMockQueryBuilder([mockTask], null, 1);
      supabaseMock.setBuilder(builder);
      await listTasks({ sortBy: 'bounty_amount', sortOrder: 'asc' });
      expect(builder.order).toHaveBeenCalledWith('bounty_amount', { ascending: true });
    });

    test('applies pagination via range', async () => {
      const builder = createMockQueryBuilder([mockTask], null, 1);
      supabaseMock.setBuilder(builder);
      await listTasks({ limit: 10, offset: 20 });
      expect(builder.range).toHaveBeenCalledWith(20, 29);
    });

    test('uses RPC when minBounty is set', async () => {
      supabaseMock.setRpcHandler((...args: any[]) => {
        const fnName = args[0];
        if (fnName === 'count_tasks_with_bounty_filter') {
          return Promise.resolve({ data: 5, error: null });
        }
        return Promise.resolve({ data: [mockTask], error: null });
      });

      const result = await listTasks({ minBounty: '100' });
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith(
        'list_tasks_with_bounty_filter',
        expect.objectContaining({
          p_min_bounty: '100',
        })
      );
      expect(result.tasks).toEqual([mockTask]);
    });

    test('uses RPC when maxBounty is set', async () => {
      supabaseMock.setRpcHandler((...args: any[]) => {
        const fnName = args[0];
        if (fnName === 'count_tasks_with_bounty_filter') {
          return Promise.resolve({ data: 3, error: null });
        }
        return Promise.resolve({ data: [mockTask], error: null });
      });

      await listTasks({ maxBounty: '500' });
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith(
        'list_tasks_with_bounty_filter',
        expect.objectContaining({
          p_max_bounty: '500',
        })
      );
    });

    test('throws on query error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }, null));
      await expect(listTasks()).rejects.toThrow('Failed to list tasks: DB error');
    });

    test('returns empty array when no data', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, null, 0));
      const result = await listTasks();
      expect(result.tasks).toEqual([]);
      expect(result.total).toBe(0);
    });

    test('skips tags filter when empty array', async () => {
      const builder = createMockQueryBuilder([mockTask], null, 1);
      supabaseMock.setBuilder(builder);
      await listTasks({ tags: [] });
      expect(builder.overlaps).not.toHaveBeenCalled();
    });

    test('defaults to created_at desc sort', async () => {
      const builder = createMockQueryBuilder([mockTask], null, 1);
      supabaseMock.setBuilder(builder);
      await listTasks();
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  describe('getTaskById', () => {
    test('returns task when found', async () => {
      const builder = createMockQueryBuilder(mockTask);
      supabaseMock.setBuilder(builder);
      const result = await getTaskById('task-1');
      expect(result).toEqual(mockTask);
      expect(builder.eq).toHaveBeenCalledWith('id', 'task-1');
      expect(builder.single).toHaveBeenCalled();
    });

    test('returns null when not found (PGRST116)', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await getTaskById('nonexistent');
      expect(result).toBeNull();
    });

    test('throws on other errors', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { code: 'OTHER', message: 'DB error' }));
      await expect(getTaskById('task-1')).rejects.toThrow('Failed to get task: DB error');
    });
  });

  describe('getTaskByChainId', () => {
    test('returns task by chain task ID', async () => {
      const builder = createMockQueryBuilder(mockTask);
      supabaseMock.setBuilder(builder);
      const result = await getTaskByChainId('1');
      expect(result).toEqual(mockTask);
      expect(builder.eq).toHaveBeenCalledWith('chain_task_id', '1');
      expect(builder.maybeSingle).toHaveBeenCalled();
    });

    test('filters by chainId when provided', async () => {
      const builder = createMockQueryBuilder(mockTask);
      supabaseMock.setBuilder(builder);
      await getTaskByChainId('1', 84532);
      expect(builder.eq).toHaveBeenCalledWith('chain_id', 84532);
    });

    test('returns null when not found', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null));
      const result = await getTaskByChainId('999');
      expect(result).toBeNull();
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(getTaskByChainId('1')).rejects.toThrow('Failed to get task: DB error');
    });
  });

  describe('createTask', () => {
    test('inserts and returns task', async () => {
      const builder = createMockQueryBuilder(mockTask);
      supabaseMock.setBuilder(builder);
      const input = {
        chain_task_id: '1',
        title: 'Test Task',
        description: 'A test task',
        bounty_amount: '1000000000000000000',
        bounty_token: '0x0000000000000000000000000000000000000000',
        creator_address: '0xabc123',
        specification_cid: 'QmTest123',
        status: 'open',
        tx_hash: '0xhash',
        chain_id: 84532,
      };
      const result = await createTask(input as any);
      expect(result).toEqual(mockTask);
      expect(builder.insert).toHaveBeenCalledWith(input);
      expect(builder.select).toHaveBeenCalled();
      expect(builder.single).toHaveBeenCalled();
    });

    test('throws on insert error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'Duplicate key' }));
      await expect(createTask({} as any)).rejects.toThrow('Failed to create task: Duplicate key');
    });
  });

  describe('updateTask', () => {
    test('updates and returns task', async () => {
      const updated = { ...mockTask, title: 'Updated Task' };
      const builder = createMockQueryBuilder(updated);
      supabaseMock.setBuilder(builder);
      const result = await updateTask('task-1', { title: 'Updated Task' } as any);
      expect(result).toEqual(updated);
      expect(builder.eq).toHaveBeenCalledWith('id', 'task-1');
    });

    test('adds updated_at timestamp', async () => {
      const builder = createMockQueryBuilder(mockTask);
      supabaseMock.setBuilder(builder);
      await updateTask('task-1', { title: 'Updated' } as any);
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ updated_at: expect.any(String) })
      );
    });

    test('throws on update error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'Not found' }));
      await expect(updateTask('task-1', {} as any)).rejects.toThrow(
        'Failed to update task: Not found'
      );
    });
  });

  describe('getTasksWithFailedIpfs', () => {
    test('queries tasks with ipfs_fetch_failed=true', async () => {
      const builder = createMockQueryBuilder([mockTask]);
      supabaseMock.setBuilder(builder);
      await getTasksWithFailedIpfs();
      expect(builder.eq).toHaveBeenCalledWith('ipfs_fetch_failed', true);
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
      expect(builder.limit).toHaveBeenCalledWith(50);
    });

    test('accepts custom limit', async () => {
      const builder = createMockQueryBuilder([]);
      supabaseMock.setBuilder(builder);
      await getTasksWithFailedIpfs(10);
      expect(builder.limit).toHaveBeenCalledWith(10);
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(getTasksWithFailedIpfs()).rejects.toThrow(
        'Failed to get tasks with failed IPFS'
      );
    });
  });

  describe('getTasksInReview', () => {
    test('queries tasks with status in_review', async () => {
      const builder = createMockQueryBuilder([mockTask], null, 1);
      supabaseMock.setBuilder(builder);
      await getTasksInReview();
      expect(builder.eq).toHaveBeenCalledWith('status', 'in_review');
      expect(builder.order).toHaveBeenCalledWith('selected_at', { ascending: true });
    });
  });

  describe('getTasksReadyForFinalization', () => {
    test('queries tasks past challenge deadline', async () => {
      const builder = createMockQueryBuilder([mockTask]);
      supabaseMock.setBuilder(builder);
      await getTasksReadyForFinalization();
      expect(builder.eq).toHaveBeenCalledWith('status', 'in_review');
      expect(builder.lte).toHaveBeenCalledWith('challenge_deadline', expect.any(String));
    });
  });
});
