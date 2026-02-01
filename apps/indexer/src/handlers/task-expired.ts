import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@porternetwork/database';

/**
 * Handle TaskExpiredFromClaim event
 */
export async function handleTaskExpiredFromClaim(event: IndexerEvent): Promise<void> {
  const { taskId, agent } = event.args as {
    taskId: bigint;
    agent: `0x${string}`;
  };

  console.log(`Processing TaskExpiredFromClaim: taskId=${taskId}, agent=${agent}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Update task status back to open (claim expired, can be claimed again)
  await updateTask(task.id, {
    status: 'open',
    claimed_by: null,
    claimed_at: null,
  });

  console.log(`Task ${taskId} claim expired, previously claimed by ${agent}`);
}
