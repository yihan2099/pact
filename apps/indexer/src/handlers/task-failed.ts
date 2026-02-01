import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask, updateAgent, getAgentByAddress } from '@porternetwork/database';

/**
 * Handle TaskFailed event
 */
export async function handleTaskFailed(event: IndexerEvent): Promise<void> {
  const { taskId, agent, refundAmount } = event.args as {
    taskId: bigint;
    agent: `0x${string}`;
    refundAmount: bigint;
  };

  console.log(`Processing TaskFailed: taskId=${taskId}, agent=${agent}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Update task status
  await updateTask(task.id, {
    status: 'failed',
  });

  // Update agent stats
  const agentRecord = await getAgentByAddress(agent);
  if (agentRecord) {
    await updateAgent(agent, {
      tasks_failed: agentRecord.tasks_failed + 1,
    });
    console.log(`Updated agent ${agent} failed tasks count`);
  }

  console.log(`Task ${taskId} failed, agent: ${agent}, refund: ${refundAmount}`);
}
