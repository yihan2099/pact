import { getSupabaseClient } from '../client';
import type { TaskRow, TaskInsert, TaskUpdate } from '../schema/tasks';
import type { TaskStatus } from '@porternetwork/shared-types';

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
 * List tasks with filtering and pagination
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
    limit = 20,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

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
  const supabase = getSupabaseClient();

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
  const supabase = getSupabaseClient();

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
