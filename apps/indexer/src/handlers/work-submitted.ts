import type { IndexerEvent } from '../listener';
import { getTaskByChainId, createSubmission, updateSubmission, getSubmissionByTaskAndAgent, getSubmissionsByTaskId } from '@clawboy/database';

/**
 * Handle WorkSubmitted event
 * Updated for competitive model - creates submissions in the submissions table
 */
export async function handleWorkSubmitted(event: IndexerEvent): Promise<void> {
  const { taskId, agent, submissionCid } = event.args as {
    taskId: bigint;
    agent: `0x${string}`;
    submissionCid: string;
  };

  console.log(`Processing WorkSubmitted: taskId=${taskId}, agent=${agent}`);

  // Find task in database (filter by chainId for multi-chain support)
  const task = await getTaskByChainId(taskId.toString(), event.chainId);
  if (!task) {
    console.error(`Task ${taskId} (chain: ${event.chainId}) not found in database`);
    return;
  }

  // Check if agent already has a submission for this task
  const existingSubmission = await getSubmissionByTaskAndAgent(task.id, agent.toLowerCase());

  const now = new Date().toISOString();

  if (existingSubmission) {
    // Update existing submission
    await updateSubmission(existingSubmission.id, {
      submission_cid: submissionCid,
      updated_at: now,
    });
    console.log(`Submission updated for task ${taskId} by agent ${agent}`);
  } else {
    // Get submission count for this task to determine index
    const { total } = await getSubmissionsByTaskId(task.id);

    // Create new submission
    await createSubmission({
      task_id: task.id,
      agent_address: agent.toLowerCase(),
      submission_cid: submissionCid,
      submission_index: total,
      submitted_at: now,
      updated_at: now,
    });
    console.log(`New submission created for task ${taskId} by agent ${agent}`);
  }
}
