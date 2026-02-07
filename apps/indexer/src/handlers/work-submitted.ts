import type { IndexerEvent } from '../listener';
import {
  getTaskByChainId,
  createSubmission,
  updateSubmission,
  getSubmissionByTaskAndAgent,
} from '@clawboy/database';
import { invalidateSubmissionCaches, invalidateTaskCaches } from '@clawboy/cache';

/**
 * Handle WorkSubmitted event
 * Updated for competitive model - creates submissions in the submissions table
 */
export async function handleWorkSubmitted(event: IndexerEvent): Promise<void> {
  const { taskId, agent, submissionCid, submissionIndex } = event.args as {
    taskId: bigint;
    agent: `0x${string}`;
    submissionCid: string;
    submissionIndex: bigint;
  };

  console.log(
    `Processing WorkSubmitted: taskId=${taskId}, agent=${agent}, index=${submissionIndex}`
  );

  // Find task in database (filter by chainId for multi-chain support)
  const task = await getTaskByChainId(taskId.toString(), event.chainId);
  if (!task) {
    // Throw error so event goes to DLQ for retry (task may be created by pending TaskCreated event)
    throw new Error(`Task ${taskId} (chain: ${event.chainId}) not found in database`);
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
    // Create new submission using on-chain submissionIndex
    await createSubmission({
      task_id: task.id,
      agent_address: agent.toLowerCase(),
      submission_cid: submissionCid,
      submission_index: Number(submissionIndex),
      submitted_at: now,
      updated_at: now,
    });
    console.log(`New submission created for task ${taskId} by agent ${agent}`);
  }

  // Invalidate relevant caches
  await Promise.all([
    invalidateSubmissionCaches(task.id, agent.toLowerCase()),
    invalidateTaskCaches(task.id), // Task may show submission count
  ]);
}
