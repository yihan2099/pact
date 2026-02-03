import { getSupabaseClient } from '../client';

export interface PlatformStatistics {
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  bountyDistributed: string; // wei string for precision
  registeredAgents: number;
  totalSubmissions: number;
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
    bountyResult,
    agentsResult,
    submissionsResult,
  ] = await Promise.all([
    // Total tasks
    supabase.from('tasks').select('*', { count: 'exact', head: true }),
    // Open tasks
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    // Completed tasks
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    // Sum of bounties from completed tasks (using RPC for precision)
    supabase.rpc('sum_completed_bounties'),
    // Total agents
    supabase.from('agents').select('*', { count: 'exact', head: true }),
    // Total submissions
    supabase.from('submissions').select('*', { count: 'exact', head: true }),
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
  if (bountyResult.error) {
    throw new Error(`Failed to get bounty sum: ${bountyResult.error.message}`);
  }
  if (agentsResult.error) {
    throw new Error(`Failed to get agents count: ${agentsResult.error.message}`);
  }
  if (submissionsResult.error) {
    throw new Error(`Failed to get submissions count: ${submissionsResult.error.message}`);
  }

  return {
    totalTasks: totalTasksResult.count ?? 0,
    openTasks: openTasksResult.count ?? 0,
    completedTasks: completedTasksResult.count ?? 0,
    bountyDistributed: (bountyResult.data as string) ?? '0',
    registeredAgents: agentsResult.count ?? 0,
    totalSubmissions: submissionsResult.count ?? 0,
  };
}
