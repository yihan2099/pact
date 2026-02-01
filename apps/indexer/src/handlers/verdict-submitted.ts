import type { IndexerEvent } from '../listener';
import {
  getTaskByChainId,
  updateTask,
  createVerdict,
  getActiveClaimForTask,
  updateClaim,
} from '@porternetwork/database';

// Map from contract enum to string
const VERDICT_OUTCOMES = ['approved', 'rejected', 'revision_requested', 'escalated'] as const;

/**
 * Handle VerdictSubmitted event
 */
export async function handleVerdictSubmitted(event: IndexerEvent): Promise<void> {
  const { taskId, verifier, outcome, score, feedbackCid } = event.args as {
    taskId: bigint;
    verifier: `0x${string}`;
    outcome: number;
    score: number;
    feedbackCid: string;
  };

  const outcomeStr = VERDICT_OUTCOMES[outcome] ?? 'unknown';
  console.log(
    `Processing VerdictSubmitted: taskId=${taskId}, verifier=${verifier}, outcome=${outcomeStr}`
  );

  // Find task in database
  const task = await getTaskByChainId(taskId.toString());
  if (!task) {
    console.error(`Task ${taskId} not found in database`);
    return;
  }

  // Find active claim for task
  const claim = await getActiveClaimForTask(task.id);
  if (!claim) {
    console.error(`No active claim found for task ${taskId}`);
    return;
  }

  // Create verdict record
  const verdict = await createVerdict({
    task_id: task.id,
    claim_id: claim.id,
    verifier_address: verifier.toLowerCase(),
    outcome: outcomeStr,
    score,
    feedback_cid: feedbackCid,
    tx_hash: event.transactionHash,
    verified_at: new Date().toISOString(),
  });

  // Update claim with verdict
  await updateClaim(claim.id, {
    status: outcomeStr,
    verdict_id: verdict.id,
  });

  // Update task status based on outcome
  let taskStatus: string;
  switch (outcomeStr) {
    case 'approved':
      taskStatus = 'completed';
      break;
    case 'rejected':
      taskStatus = 'failed';
      break;
    case 'revision_requested':
      taskStatus = 'claimed'; // Back to claimed for revision
      break;
    case 'escalated':
      taskStatus = 'disputed';
      break;
    default:
      taskStatus = 'submitted';
  }

  await updateTask(task.id, {
    status: taskStatus,
  });

  console.log(
    `Verdict submitted for task ${taskId}: ${outcomeStr} (score: ${score})`
  );
}
