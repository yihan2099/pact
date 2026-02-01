import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask, updateAgent, getAgentByAddress } from '@porternetwork/database';

/**
 * Handle TaskCompleted event
 */
export async function handleTaskCompleted(event: IndexerEvent): Promise<void> {
  const { taskId, agent, bountyAmount } = event.args as {
    taskId: bigint;
    agent: `0x${string}`;
    bountyAmount: bigint;
  };

  console.log(`Processing TaskCompleted: taskId=${taskId}, agent=${agent}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Update task status
  await updateTask(task.id, {
    status: 'completed',
  });

  // Update agent stats
  const agentRecord = await getAgentByAddress(agent);
  if (agentRecord) {
    await updateAgent(agent, {
      tasks_completed: agentRecord.tasks_completed + 1,
    });
    console.log(`Updated agent ${agent} completed tasks count`);
  }

  console.log(
    `Task ${taskId} completed, ${bountyAmount} paid to ${agent}`
  );
}
