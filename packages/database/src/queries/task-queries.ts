import { getSupabaseClient, getSupabaseAdminClient } from '../client';
import type { TaskRow, TaskInsert, TaskUpdate } from '../schema/tasks';
import type { TaskStatus } from '@porternetwork/shared-types';

// Use admin client for write operations (bypasses RLS)
const getWriteClient = () => getSupabaseAdminClient();

export interface ListTasksOptions {
  status?: TaskStatus;
  creatorAddress?: string;
  claimedBy?: string;
  tags?: string[];
  minBounty?: string;
  maxBounty?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'bounty_amount' | 'created_at' | 'deadline';
  sortOrder?: 'asc' | 'desc';
}

/**
 * List tasks with filtering and pagination.
 * Uses PostgreSQL RPC function for proper numeric bounty comparison when
 * bounty filters are provided, otherwise uses standard Supabase query.
 */
export async function listTasks(options: ListTasksOptions = {}): Promise<{
  tasks: TaskRow[];
  total: number;
}> {
  const supabase = getSupabaseClient();
  const {
    status,
    creatorAddress,
    claimedBy,
    tags,
    minBounty,
    maxBounty,
    limit = 20,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  // When bounty filters are provided, use RPC function for proper numeric comparison
  // This is necessary because bounty_amount is stored as TEXT (wei strings),
  // and lexicographic comparison doesn't work correctly for numeric values
  // (e.g., "500000..." > "1000000..." lexicographically, but < numerically)
  if (minBounty || maxBounty) {
    const { data, error } = await supabase.rpc('list_tasks_with_bounty_filter', {
      p_min_bounty: minBounty || null,
      p_max_bounty: maxBounty || null,
      p_status: status || null,
      p_creator_address: creatorAddress?.toLowerCase() || null,
      p_claimed_by: claimedBy?.toLowerCase() || null,
      p_tags: tags && tags.length > 0 ? tags : null,
      p_limit: limit,
      p_offset: offset,
      p_sort_by: sortBy,
      p_sort_order: sortOrder,
    });

    if (error) {
      throw new Error(`Failed to list tasks: ${error.message}`);
    }

    const tasks = (data ?? []) as TaskRow[];

    // Get accurate count using the companion count function
    const { data: countData, error: countError } = await supabase.rpc('count_tasks_with_bounty_filter', {
      p_min_bounty: minBounty || null,
      p_max_bounty: maxBounty || null,
      p_status: status || null,
      p_creator_address: creatorAddress?.toLowerCase() || null,
      p_claimed_by: claimedBy?.toLowerCase() || null,
      p_tags: tags && tags.length > 0 ? tags : null,
    });

    if (countError) {
      // Non-fatal: return tasks without accurate total
      return { tasks, total: tasks.length };
    }

    return { tasks, total: (countData as number) ?? tasks.length };
  }

  // Standard query without bounty filtering
  let query = supabase.from('tasks').select('*', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  if (creatorAddress) {
    query = query.eq('creator_address', creatorAddress.toLowerCase());
  }

  if (claimedBy) {
    query = query.eq('claimed_by', claimedBy.toLowerCase());
  }

  if (tags && tags.length > 0) {
    query = query.overlaps('tags', tags);
  }

  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list tasks: ${error.message}`);
  }

  return {
    tasks: (data ?? []) as TaskRow[],
    total: count ?? 0,
  };
}

/**
 * Get a task by its database ID
 */
export async function getTaskById(id: string): Promise<TaskRow | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get task: ${error.message}`);
  }

  return data as TaskRow;
}

/**
 * Get a task by its on-chain task ID
 */
export async function getTaskByChainId(
  chainTaskId: string
): Promise<TaskRow | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('chain_task_id', chainTaskId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get task: ${error.message}`);
  }

  return data as TaskRow;
}

/**
 * Create a new task
 */
export async function createTask(task: TaskInsert): Promise<TaskRow> {
  const supabase = getWriteClient();

  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  return data as TaskRow;
}

/**
 * Update a task
 */
export async function updateTask(
  id: string,
  updates: TaskUpdate
): Promise<TaskRow> {
  const supabase = getWriteClient();

  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update task: ${error.message}`);
  }

  return data as TaskRow;
}

/**
 * Get tasks pending verification
 */
export async function getPendingVerificationTasks(
  limit = 20,
  offset = 0
): Promise<{ tasks: TaskRow[]; total: number }> {
  const supabase = getSupabaseClient();

  const { data, error, count } = await supabase
    .from('tasks')
    .select('*', { count: 'exact' })
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get pending tasks: ${error.message}`);
  }

  return {
    tasks: (data ?? []) as TaskRow[],
    total: count ?? 0,
  };
}
