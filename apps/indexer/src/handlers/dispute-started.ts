import type { IndexerEvent } from '../listener';
import { getTaskByChainId, createDispute } from '@clawboy/database';

/**
 * Handle DisputeStarted event
 * A new dispute has been opened against a task decision
 */
export async function handleDisputeStarted(event: IndexerEvent): Promise<void> {
  const { disputeId, taskId, disputer, stake, votingDeadline } = event.args as {
    disputeId: bigint;
    taskId: bigint;
    disputer: `0x${string}`;
    stake: bigint;
    votingDeadline: bigint;
  };

  console.log(`Processing DisputeStarted: disputeId=${disputeId}, taskId=${taskId}, disputer=${disputer}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Create dispute record
  await createDispute({
    task_id: task.id,
    chain_dispute_id: disputeId.toString(),
    disputer_address: disputer.toLowerCase(),
    dispute_stake: stake.toString(),
    voting_deadline: new Date(Number(votingDeadline) * 1000).toISOString(),
    status: 'active',
    tx_hash: event.transactionHash,
  });

  console.log(`Dispute ${disputeId} started for task ${taskId} by ${disputer}, stake: ${stake}`);
}
