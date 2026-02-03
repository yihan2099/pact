import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask, updateAgent, getAgentByAddress, markSubmissionAsWinner } from '@clawboy/database';

/**
 * Handle TaskCompleted event
 * Updated for competitive model - updates tasks_won instead of tasks_completed
 */
export async function handleTaskCompleted(event: IndexerEvent): Promise<void> {
  const { taskId, winner, bountyAmount } = event.args as {
    taskId: bigint;
    winner: `0x${string}`;
    bountyAmount: bigint;
  };

  console.log(`Processing TaskCompleted: taskId=${taskId}, winner=${winner}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Update task status
  await updateTask(task.id, {
    status: 'completed',
    winner_address: winner.toLowerCase(),
  });

  // Mark the winning submission
  await markSubmissionAsWinner(task.id, winner.toLowerCase());

  // Update agent stats (tasks_won in competitive model)
  const agentRecord = await getAgentByAddress(winner);
  if (agentRecord) {
    await updateAgent(winner, {
      tasks_won: agentRecord.tasks_won + 1,
    });
    console.log(`Updated agent ${winner} tasks won count`);
  }

  console.log(
    `Task ${taskId} completed, ${bountyAmount} paid to ${winner}`
  );
}
