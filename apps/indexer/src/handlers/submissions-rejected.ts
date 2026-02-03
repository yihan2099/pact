import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@clawboy/database';

/**
 * Handle AllSubmissionsRejected event
 * Task creator has rejected all submissions, bounty refunded
 */
export async function handleAllSubmissionsRejected(event: IndexerEvent): Promise<void> {
  const { taskId, reason } = event.args as {
    taskId: bigint;
    reason: string;
  };

  console.log(`Processing AllSubmissionsRejected: taskId=${taskId}, reason=${reason}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Update task status to in_review (can still be disputed)
  await updateTask(task.id, {
    status: 'in_review',
    selected_at: new Date().toISOString(),
    // challenge_deadline will be set if disputable
  });

  console.log(`All submissions rejected for task ${taskId}: ${reason}`);
}
