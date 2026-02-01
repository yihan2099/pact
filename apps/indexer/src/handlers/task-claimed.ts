import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@porternetwork/database';

/**
 * Handle TaskClaimed event
 */
export async function handleTaskClaimed(event: IndexerEvent): Promise<void> {
  const { taskId, agent, claimDeadline } = event.args as {
    taskId: bigint;
    agent: `0x${string}`;
    claimDeadline: bigint;
  };

  console.log(`Processing TaskClaimed: taskId=${taskId}, agent=${agent}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Update task status
  await updateTask(task.id, {
    status: 'claimed',
    claimed_by: agent.toLowerCase(),
    claimed_at: new Date().toISOString(),
    deadline:
      claimDeadline > 0n
        ? new Date(Number(claimDeadline) * 1000).toISOString()
        : null,
  });

  console.log(`Task ${taskId} claimed by ${agent}`);
}
