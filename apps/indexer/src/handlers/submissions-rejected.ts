import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@clawboy/database';
import { invalidateTaskCaches, invalidateSubmissionCaches } from '@clawboy/cache';

/**
 * Handle AllSubmissionsRejected event
 * Task creator has rejected all submissions, bounty refunded
 */
export async function handleAllSubmissionsRejected(event: IndexerEvent): Promise<void> {
  const { taskId, creator, reason } = event.args as {
    taskId: bigint;
    creator: `0x${string}`;
    reason: string;
  };

  console.log(
    `Processing AllSubmissionsRejected: taskId=${taskId}, creator=${creator}, reason=${reason}`
  );

  // Find task in database
  const task = await getTaskByChainId(taskId.toString(), event.chainId);
  if (!task) {
    // Throw error so event goes to DLQ for retry
    throw new Error(`Task ${taskId} (chain: ${event.chainId}) not found in database`);
  }

  // Calculate challenge deadline: block timestamp + 48 hours
  // The on-chain contract sets challengeDeadline = block.timestamp + CHALLENGE_WINDOW (48h)
  const CHALLENGE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours in ms
  const now = new Date();
  const challengeDeadline = new Date(now.getTime() + CHALLENGE_WINDOW_MS).toISOString();

  // Update task status to in_review (can still be disputed)
  await updateTask(task.id, {
    status: 'in_review',
    selected_at: now.toISOString(),
    challenge_deadline: challengeDeadline,
  });

  // Invalidate relevant caches
  await Promise.all([invalidateTaskCaches(task.id), invalidateSubmissionCaches(task.id)]);

  console.log(`All submissions rejected for task ${taskId} by ${creator}: ${reason}`);
}
