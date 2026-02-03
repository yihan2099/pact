import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@clawboy/database';

/**
 * Handle WinnerSelected event
 * Task creator has selected a winner, starts 48h challenge window
 */
export async function handleWinnerSelected(event: IndexerEvent): Promise<void> {
  const { taskId, winner, challengeDeadline } = event.args as {
    taskId: bigint;
    winner: `0x${string}`;
    challengeDeadline: bigint;
  };

  console.log(`Processing WinnerSelected: taskId=${taskId}, winner=${winner}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Update task with winner and challenge deadline
  await updateTask(task.id, {
    status: 'in_review',
    winner_address: winner.toLowerCase(),
    selected_at: new Date().toISOString(),
    challenge_deadline: new Date(Number(challengeDeadline) * 1000).toISOString(),
  });

  console.log(`Winner ${winner} selected for task ${taskId}, challenge deadline: ${challengeDeadline}`);
}
