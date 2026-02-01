/**
 * Verdict outcome
 */
export enum VerdictOutcome {
  /** Work approved, bounty released to agent */
  Approved = 'approved',
  /** Work rejected, bounty returned to creator */
  Rejected = 'rejected',
  /** Revision requested before final decision */
  RevisionRequested = 'revision_requested',
  /** Escalated to dispute resolution */
  Escalated = 'escalated',
}

/**
 * Verification verdict record
 */
export interface Verdict {
  /** Unique verdict ID */
  id: string;

  /** Task ID */
  taskId: string;

  /** Claim ID */
  claimId: string;

  /** Verifier address */
  verifierAddress: `0x${string}`;

  /** Verdict outcome */
  outcome: VerdictOutcome;

  /** Score given (0-100) */
  score: number;

  /** IPFS CID for detailed feedback */
  feedbackCid: string;

  /** Timestamp of verdict */
  verifiedAt: string;

  /** On-chain transaction hash */
  txHash: `0x${string}`;
}

/**
 * Verdict with resolved feedback
 */
export interface VerdictWithFeedback extends Verdict {
  feedback: import('./feedback').VerificationFeedback;
}

/**
 * Parameters for submitting a verdict
 */
export interface SubmitVerdictParams {
  taskId: string;
  claimId: string;
  outcome: VerdictOutcome;
  feedback: import('./feedback').VerificationFeedback;
}

/**
 * Pending verification item
 */
export interface PendingVerification {
  taskId: string;
  claimId: string;
  agentAddress: `0x${string}`;
  submissionCid: string;
  submittedAt: string;
  deadline: string | null;
  bountyAmount: string;
  bountyToken: `0x${string}`;
}
