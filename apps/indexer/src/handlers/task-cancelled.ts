import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@clawboy/database';
import { assertValidStatusTransition, type TaskStatusString } from '@clawboy/shared-types';

/**
 * Handle TaskCancelled event
 */
export async function handleTaskCancelled(event: IndexerEvent): Promise<void> {
  const { taskId, creator, refundAmount } = event.args as {
    taskId: bigint;
    creator: `0x${string}`;
    refundAmount: bigint;
  };

  console.log(`Processing TaskCancelled: taskId=${taskId}, creator=${creator}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString(), event.chainId);
  if (!task) {
    console.error(`Task ${taskId} (chain: ${event.chainId}) not found in database`);
    return;
  }

  // Validate status transition
  const currentStatus = task.status as TaskStatusString;
  const newStatus: TaskStatusString = 'cancelled';
  assertValidStatusTransition(currentStatus, newStatus, task.chain_task_id);

  // Update task status
  await updateTask(task.id, {
    status: newStatus,
  });

  console.log(`Task ${taskId} cancelled by ${creator}, refund: ${refundAmount}`);
}
