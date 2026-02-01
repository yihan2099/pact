import { uploadWorkSubmission, fetchWorkSubmission } from '@porternetwork/ipfs-utils';
import type { SubmitWorkInput, ClaimTaskInput } from '@porternetwork/shared-types';

/**
 * Prepare a task claim
 * Note: Actual claim happens on-chain
 */
export async function prepareClaimHandler(
  input: ClaimTaskInput,
  agentAddress: `0x${string}`
): Promise<{
  taskId: string;
  agentAddress: `0x${string}`;
  message?: string;
}> {
  // Validate task exists and is claimable
  // In production, check on-chain state

  return {
    taskId: input.taskId,
    agentAddress,
    message: input.message,
  };
}

/**
 * Prepare work submission
 * Uploads submission to IPFS for on-chain reference
 */
export async function prepareSubmitWorkHandler(
  input: SubmitWorkInput,
  agentAddress: `0x${string}`
): Promise<{
  taskId: string;
  submissionCid: string;
}> {
  // Create work submission
  const submission = {
    version: '1.0' as const,
    taskId: input.taskId,
    summary: input.summary,
    description: input.description,
    deliverables: input.deliverables.map((d) => ({
      type: d.type as 'code' | 'document' | 'data' | 'file' | 'other',
      description: d.description,
      cid: d.cid,
      url: d.url,
    })),
    verifierNotes: input.verifierNotes,
    submittedAt: new Date().toISOString(),
  };

  // Upload to IPFS
  const uploadResult = await uploadWorkSubmission(submission);

  return {
    taskId: input.taskId,
    submissionCid: uploadResult.cid,
  };
}

/**
 * Get claims for an agent
 */
export async function getAgentClaimsHandler(
  agentAddress: `0x${string}`,
  status?: string,
  limit?: number
): Promise<{
  claims: Array<{
    claimId: string;
    taskId: string;
    taskTitle: string;
    status: string;
    claimedAt: string;
    deadline: string | null;
    bountyAmount: string;
  }>;
  total: number;
}> {
  // In production, query database for claims
  // For now, return empty array
  return {
    claims: [],
    total: 0,
  };
}
