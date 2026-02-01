import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@porternetwork/database';

/**
 * Handle TaskReopenedForRevision event
 */
export async function handleTaskReopenedForRevision(event: IndexerEvent): Promise<void> {
  const { taskId, agent } = event.args as {
    taskId: bigint;
    agent: `0x${string}`;
  };

  console.log(`Processing TaskReopenedForRevision: taskId=${taskId}, agent=${agent}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Update task status back to claimed (agent needs to revise and resubmit)
  await updateTask(task.id, {
    status: 'claimed',
    submission_cid: null,
    submitted_at: null,
  });

  console.log(`Task ${taskId} reopened for revision by agent ${agent}`);
}
