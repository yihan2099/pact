import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@clawboy/database';
import { assertValidStatusTransition, type TaskStatusString } from '@clawboy/shared-types';

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
  const task = await getTaskByChainId(taskId.toString(), event.chainId);
  if (!task) {
    console.error(`Task ${taskId} (chain: ${event.chainId}) not found in database`);
    return;
  }

  // Validate status transition
  const currentStatus = task.status as TaskStatusString;
  const newStatus: TaskStatusString = 'disputed';
  assertValidStatusTransition(currentStatus, newStatus, task.chain_task_id);

  // Update task status to disputed
  await updateTask(task.id, {
    status: newStatus,
  });

  console.log(`Task ${taskId} disputed by ${disputer}`);
}
