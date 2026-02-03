import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@clawboy/database';

/**
 * Handle TaskDisputed event
 * An agent has disputed the task decision
 */
export async function handleTaskDisputed(event: IndexerEvent): Promise<void> {
  const { taskId, disputer } = event.args as {
    taskId: bigint;
    disputer: `0x${string}`;
  };

  console.log(`Processing TaskDisputed: taskId=${taskId}, disputer=${disputer}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Update task status to disputed
  await updateTask(task.id, {
    status: 'disputed',
  });

  console.log(`Task ${taskId} disputed by ${disputer}`);
}
