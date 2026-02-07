import { getSupabaseClient } from '../client';
import type { TaskRow } from '../schema/tasks';
import type { SubmissionRow } from '../schema/submissions';

/**
 * Tag statistics for displaying category breakdown
 */
export interface TagStatistic {
  tag: string;
  count: number;
}

/**
 * Featured completed task with details for showcase
 */
export interface FeaturedTask {
  id: string;
  title: string;
  description: string;
  tags: string[];
  bounty_amount: string;
  created_at: string;
  selected_at: string | null;
}

/**
 * Bounty distribution statistics
 */
export interface BountyStatistics {
  minBounty: string;
  maxBounty: string;
  avgBounty: string;
}

export interface PlatformStatistics {
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  refundedTasks: number;
  bountyDistributed: string; // wei string for precision
  bountyAvailable: string; // wei string - sum of open task bounties
  registeredAgents: number;
  totalSubmissions: number;
  activeDisputes: number;
  avgCompletionHours: number | null; // average hours from creation to completion
}

/**
 * Get platform-wide statistics for display on the landing page.
 * Runs parallel queries for efficiency.
 */
export async function getPlatformStatistics(): Promise<PlatformStatistics> {
  const supabase = getSupabaseClient();

  const [
    totalTasksResult,
    openTasksResult,
    completedTasksResult,
    refundedTasksResult,
    bountyDistributedResult,
    bountyAvailableResult,
    agentsResult,
    submissionsResult,
    activeDisputesResult,
    completedTasksForAvgResult,
  ] = await Promise.all([
    // Total tasks
    supabase.from('tasks').select('*', { count: 'exact', head: true }),
    // Open tasks
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    // Completed tasks
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    // Refunded tasks (cancelled/expired)
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'refunded'),
    // Sum of bounties from completed tasks (using RPC for precision)
    supabase.rpc('sum_completed_bounties'),
    // Sum of bounties from open tasks (using RPC for precision)
    supabase.rpc('sum_open_bounties'),
    // Total agents
    supabase.from('agents').select('*', { count: 'exact', head: true }),
    // Total submissions
    supabase.from('submissions').select('*', { count: 'exact', head: true }),
    // Active disputes
    supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    // Completed tasks with timestamps for avg calculation
    supabase
      .from('tasks')
      .select('created_at, selected_at')
      .eq('status', 'completed')
      .not('selected_at', 'is', null),
  ]);

  // Check for errors
  if (totalTasksResult.error) {
    throw new Error(`Failed to get total tasks: ${totalTasksResult.error.message}`);
  }
  if (openTasksResult.error) {
    throw new Error(`Failed to get open tasks: ${openTasksResult.error.message}`);
  }
  if (completedTasksResult.error) {
    throw new Error(`Failed to get completed tasks: ${completedTasksResult.error.message}`);
  }
  if (refundedTasksResult.error) {
    throw new Error(`Failed to get refunded tasks: ${refundedTasksResult.error.message}`);
  }
  if (bountyDistributedResult.error) {
    throw new Error(`Failed to get bounty distributed: ${bountyDistributedResult.error.message}`);
  }
  if (bountyAvailableResult.error) {
    throw new Error(`Failed to get bounty available: ${bountyAvailableResult.error.message}`);
  }
  if (agentsResult.error) {
    throw new Error(`Failed to get agents count: ${agentsResult.error.message}`);
  }
  if (submissionsResult.error) {
    throw new Error(`Failed to get submissions count: ${submissionsResult.error.message}`);
  }
  if (activeDisputesResult.error) {
    throw new Error(`Failed to get active disputes: ${activeDisputesResult.error.message}`);
  }
  // Note: completedTasksForAvgResult errors are non-fatal, we just skip the avg calculation

  // Calculate average completion time in hours
  let avgCompletionHours: number | null = null;
  if (!completedTasksForAvgResult.error && completedTasksForAvgResult.data) {
    const tasks = completedTasksForAvgResult.data as Array<{
      created_at: string;
      selected_at: string;
    }>;
    if (tasks.length > 0) {
      const totalHours = tasks.reduce((sum, task) => {
        const created = new Date(task.created_at).getTime();
        const completed = new Date(task.selected_at).getTime();
        const hours = (completed - created) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);
      avgCompletionHours = Math.round((totalHours / tasks.length) * 10) / 10; // 1 decimal place
    }
  }

  return {
    totalTasks: totalTasksResult.count ?? 0,
    openTasks: openTasksResult.count ?? 0,
    completedTasks: completedTasksResult.count ?? 0,
    refundedTasks: refundedTasksResult.count ?? 0,
    bountyDistributed: (bountyDistributedResult.data as string) ?? '0',
    bountyAvailable: (bountyAvailableResult.data as string) ?? '0',
    registeredAgents: agentsResult.count ?? 0,
    totalSubmissions: submissionsResult.count ?? 0,
    activeDisputes: activeDisputesResult.count ?? 0,
    avgCompletionHours,
  };
}

/**
 * Get recent open tasks for display on the landing page.
 */
export async function getRecentOpenTasks(limit = 5): Promise<TaskRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get recent open tasks: ${error.message}`);
  }

  return (data ?? []) as TaskRow[];
}

/**
 * Submission with associated task information
 */
export interface SubmissionWithTask extends SubmissionRow {
  task: Pick<TaskRow, 'title' | 'bounty_amount' | 'status'> | null;
}

/**
 * Get recent submissions with task info for display on the landing page.
 */
export async function getRecentSubmissions(limit = 5): Promise<SubmissionWithTask[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('submissions')
    .select(
      `
      *,
      task:tasks!task_id (
        title,
        bounty_amount,
        status
      )
    `
    )
    .order('submitted_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get recent submissions: ${error.message}`);
  }

  return (data ?? []) as SubmissionWithTask[];
}

/**
 * Detailed task info for the mini dashboard
 */
export interface DetailedTask {
  id: string;
  chain_task_id: string;
  title: string;
  description: string;
  status: string;
  bounty_amount: string;
  bounty_token: string;
  creator_address: string;
  winner_address: string | null;
  specification_cid: string;
  tags: string[];
  deadline: string | null;
  submission_count: number;
  selected_at: string | null;
  challenge_deadline: string | null;
  created_at: string;
}

/**
 * Get detailed tasks for the mini dashboard.
 * Returns recent tasks with full details for display.
 */
export async function getDetailedTasks(limit = 3): Promise<DetailedTask[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .select(
      'id, chain_task_id, title, description, status, bounty_amount, bounty_token, creator_address, winner_address, specification_cid, tags, deadline, submission_count, selected_at, challenge_deadline, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get detailed tasks: ${error.message}`);
  }

  return (data ?? []) as DetailedTask[];
}

/**
 * Detailed dispute info for the mini dashboard
 */
export interface DetailedDispute {
  id: string;
  chain_dispute_id: string;
  task_id: string;
  disputer_address: string;
  dispute_stake: string;
  voting_deadline: string;
  status: string;
  disputer_won: boolean | null;
  votes_for_disputer: string;
  votes_against_disputer: string;
  tx_hash: string;
  created_at: string;
  resolved_at: string | null;
  task: Pick<TaskRow, 'title' | 'bounty_amount'> | null;
}

/**
 * Get detailed disputes for the mini dashboard.
 */
export async function getDetailedDisputes(limit = 3): Promise<DetailedDispute[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('disputes')
    .select(
      `
      *,
      task:tasks!task_id (
        title,
        bounty_amount
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get detailed disputes: ${error.message}`);
  }

  return (data ?? []) as DetailedDispute[];
}

/**
 * Get tag statistics - count of tasks per tag for category breakdown.
 * Returns top N tags by task count.
 */
export async function getTagStatistics(limit = 6): Promise<TagStatistic[]> {
  const supabase = getSupabaseClient();

  // Fetch all tasks with tags (we'll aggregate in memory since Supabase
  // doesn't support array unnesting in a simple query)
  const { data, error } = await supabase.from('tasks').select('tags').not('tags', 'is', null);

  if (error) {
    throw new Error(`Failed to get tag statistics: ${error.message}`);
  }

  // Aggregate tag counts
  const tagCounts = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.tags && Array.isArray(row.tags)) {
      for (const tag of row.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
  }

  // Sort by count descending and take top N
  const sortedTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));

  return sortedTags;
}

/**
 * Get recently completed tasks for the featured showcase.
 */
export async function getFeaturedCompletedTasks(limit = 3): Promise<FeaturedTask[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, tags, bounty_amount, created_at, selected_at')
    .eq('status', 'completed')
    .order('selected_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get featured completed tasks: ${error.message}`);
  }

  return (data ?? []) as FeaturedTask[];
}

/**
 * Get bounty distribution statistics (min, max, avg).
 */
export async function getBountyStatistics(): Promise<BountyStatistics> {
  const supabase = getSupabaseClient();

  // Get all bounty amounts to calculate statistics
  // Note: Using individual queries since Supabase doesn't have built-in aggregation functions
  const { data, error } = await supabase.from('tasks').select('bounty_amount');

  if (error) {
    throw new Error(`Failed to get bounty statistics: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      minBounty: '0',
      maxBounty: '0',
      avgBounty: '0',
    };
  }

  // Convert to BigInt for precision
  const amounts = data.map((row) => BigInt(row.bounty_amount));
  const min = amounts.reduce((a, b) => (a < b ? a : b), amounts[0]);
  const max = amounts.reduce((a, b) => (a > b ? a : b), amounts[0]);
  const sum = amounts.reduce((a, b) => a + b, BigInt(0));
  const avg = sum / BigInt(amounts.length);

  return {
    minBounty: min.toString(),
    maxBounty: max.toString(),
    avgBounty: avg.toString(),
  };
}
