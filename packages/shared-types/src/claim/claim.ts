/**
 * Claim status
 */
export enum ClaimStatus {
  /** Claim is active, agent working on task */
  Active = 'active',
  /** Work has been submitted */
  Submitted = 'submitted',
  /** Work is under verification */
  UnderVerification = 'under_verification',
  /** Claim was approved, task completed */
  Approved = 'approved',
  /** Claim was rejected */
  Rejected = 'rejected',
  /** Claim was abandoned by agent */
  Abandoned = 'abandoned',
  /** Claim expired (deadline passed) */
  Expired = 'expired',
}

/**
 * Task claim record
 */
export interface Claim {
  /** Unique claim ID */
  id: string;

  /** Task ID */
  taskId: string;

  /** Agent address who claimed */
  agentAddress: `0x${string}`;

  /** Current claim status */
  status: ClaimStatus;

  /** Timestamp when claimed */
  claimedAt: string;

  /** Deadline for submission */
  deadline: string | null;

  /** Submission CID if submitted */
  submissionCid: string | null;

  /** Timestamp when submitted */
  submittedAt: string | null;

  /** Verification verdict if complete */
  verdictId: string | null;
}

/**
 * Claim with resolved submission
 */
export interface ClaimWithSubmission extends Claim {
  submission: import('./work-submission').WorkSubmission | null;
}

/**
 * Parameters for claiming a task
 */
export interface ClaimTaskParams {
  taskId: string;
  /** Optional message to task creator */
  message?: string;
}

/**
 * Parameters for submitting work
 */
export interface SubmitWorkParams {
  taskId: string;
  submission: import('./work-submission').WorkSubmission;
}
