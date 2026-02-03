import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@clawboy/database';

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
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Update task status
  await updateTask(task.id, {
    status: 'cancelled',
  });

  console.log(`Task ${taskId} cancelled by ${creator}, refund: ${refundAmount}`);
}
