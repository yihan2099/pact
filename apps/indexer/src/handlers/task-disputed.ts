import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@clawboy/database';
import { assertValidStatusTransition, type TaskStatusString } from '@clawboy/shared-types';
import { invalidateTaskCaches } from '@clawboy/cache';

/**
 * Handle TaskDisputed event
 * An agent has disputed the task decision
 */
export async function handleTaskDisputed(event: IndexerEvent): Promise<void> {
  const { taskId, disputer, disputeId } = event.args as {
    taskId: bigint;
    disputer: `0x${string}`;
    disputeId: bigint;
  };

  console.log(
    `Processing TaskDisputed: taskId=${taskId}, disputer=${disputer}, disputeId=${disputeId}`
  );

  // Find task in database
  const task = await getTaskByChainId(taskId.toString(), event.chainId);
  if (!task) {
    // Throw error so event goes to DLQ for retry
    throw new Error(`Task ${taskId} (chain: ${event.chainId}) not found in database`);
  }

  // Validate status transition
  const currentStatus = task.status as TaskStatusString;
  const newStatus: TaskStatusString = 'disputed';
  assertValidStatusTransition(currentStatus, newStatus, task.chain_task_id);

  // Update task status to disputed
  // Note: disputeId is stored on the disputes table (chain_dispute_id), not on tasks
  await updateTask(task.id, {
    status: newStatus,
  });

  // Invalidate task caches
  await invalidateTaskCaches(task.id);

  console.log(`Task ${taskId} disputed by ${disputer}, disputeId=${disputeId}`);
}
