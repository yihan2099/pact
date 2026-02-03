import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@clawboy/database';
import { assertValidStatusTransition, type TaskStatusString } from '@clawboy/shared-types';

/**
 * Handle TaskRefunded event
 * Bounty returned to creator (rejected submissions or deadline passed)
 */
export async function handleTaskRefunded(event: IndexerEvent): Promise<void> {
  const { taskId, creator, refundAmount } = event.args as {
    taskId: bigint;
    creator: `0x${string}`;
    refundAmount: bigint;
  };

  console.log(`Processing TaskRefunded: taskId=${taskId}, creator=${creator}, amount=${refundAmount}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Validate status transition
  const currentStatus = task.status as TaskStatusString;
  const newStatus: TaskStatusString = 'refunded';
  assertValidStatusTransition(currentStatus, newStatus, task.chain_task_id);

  // Update task status to refunded
  await updateTask(task.id, {
    status: newStatus,
  });

  console.log(`Task ${taskId} refunded ${refundAmount} to ${creator}`);
}
