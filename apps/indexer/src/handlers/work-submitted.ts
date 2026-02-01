import type { IndexerEvent } from '../listener';
import { getTaskByChainId, updateTask } from '@porternetwork/database';

/**
 * Handle WorkSubmitted event
 */
export async function handleWorkSubmitted(event: IndexerEvent): Promise<void> {
  const { taskId, agent, submissionCid } = event.args as {
    taskId: bigint;
    agent: `0x${string}`;
    submissionCid: string;
  };

  console.log(`Processing WorkSubmitted: taskId=${taskId}, agent=${agent}`);

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Verify the submitter is the one who claimed the task
  if (task.claimed_by?.toLowerCase() !== agent.toLowerCase()) {
    console.error(
      `Work submitted by ${agent} but task was claimed by ${task.claimed_by}`
    );
    return;
  }

  // Update task status
  await updateTask(task.id, {
    status: 'submitted',
    submission_cid: submissionCid,
    submitted_at: new Date().toISOString(),
  });

  console.log(`Work submitted for task ${taskId}, CID: ${submissionCid}`);
}
