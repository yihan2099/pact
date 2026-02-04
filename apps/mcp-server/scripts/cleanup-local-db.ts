/**
 * Cleanup script to remove old chain_id=31337 records from Supabase
 * Run with: bun scripts/cleanup-local-db.ts
 */
import { getSupabaseAdminClient } from '@clawboy/database';

const supabase = getSupabaseAdminClient();

async function cleanup() {
  const chainId = 31337;
  console.log(`Cleaning up database records for chain_id=${chainId}...`);

  // Get task IDs first
  const { data: tasks } = await supabase.from('tasks').select('id').eq('chain_id', chainId);

  const taskIds = tasks?.map((t) => t.id) || [];
  console.log(`Found ${taskIds.length} tasks to delete`);

  if (taskIds.length > 0) {
    // Delete submissions for these tasks
    const subResult = await supabase.from('submissions').delete().in('task_id', taskIds);
    console.log(
      `Deleted submissions`,
      subResult.error ? `Error: ${subResult.error.message}` : 'OK'
    );

    // Delete disputes for these tasks
    const dispResult = await supabase.from('disputes').delete().in('task_id', taskIds);
    console.log(`Deleted disputes`, dispResult.error ? `Error: ${dispResult.error.message}` : 'OK');
  }

  // Delete tasks
  const taskResult = await supabase.from('tasks').delete().eq('chain_id', chainId);
  console.log(`Deleted tasks`, taskResult.error ? `Error: ${taskResult.error.message}` : 'OK');

  // Delete agents
  const agentResult = await supabase.from('agents').delete().eq('chain_id', chainId);
  console.log(`Deleted agents`, agentResult.error ? `Error: ${agentResult.error.message}` : 'OK');

  // Delete sync_state (indexer checkpoints)
  const syncResult = await supabase.from('sync_state').delete().eq('chain_id', chainId);
  console.log(`Deleted sync_state`, syncResult.error ? `Error: ${syncResult.error.message}` : 'OK');

  // Delete processed_events (event deduplication)
  const processedResult = await supabase.from('processed_events').delete().eq('chain_id', chainId);
  console.log(
    `Deleted processed_events`,
    processedResult.error ? `Error: ${processedResult.error.message}` : 'OK'
  );

  // Delete failed_events (DLQ)
  const failedResult = await supabase.from('failed_events').delete().eq('chain_id', chainId);
  console.log(
    `Deleted failed_events`,
    failedResult.error ? `Error: ${failedResult.error.message}` : 'OK'
  );

  console.log('\nDatabase cleanup complete!');
}

cleanup().catch(console.error);
