/**
 * Verification feedback stored on IPFS
 * Detailed feedback from verifier about the work
 */
export interface VerificationFeedback {
  /** Schema version for future compatibility */
  version: '1.0';

  /** Task ID this feedback is for */
  taskId: string;

  /** Claim ID being verified */
  claimId: string;

  /** Overall verdict */
  verdict: 'approved' | 'rejected' | 'revision_requested';

  /** Overall score (0-100) */
  score: number;

  /** Detailed feedback text */
  feedback: string;

  /** Per-deliverable assessments */
  deliverableAssessments?: DeliverableAssessment[];

  /** Criteria assessments */
  criteria?: CriteriaAssessment[];

  /** Recommendations for improvement */
  recommendations?: string[];

  /** Verification timestamp */
  verifiedAt: string;
}

export interface DeliverableAssessment {
  /** Index of the deliverable */
  index: number;

  /** Whether it meets requirements */
  meetsRequirements: boolean;

  /** Quality score (0-100) */
  qualityScore: number;

  /** Specific feedback */
  feedback: string;

  /** Issues found */
  issues?: string[];
}

export interface CriteriaAssessment {
  /** Criteria name */
  name: string;

  /** Score for this criteria (0-100) */
  score: number;

  /** Weight of this criteria */
  weight: number;

  /** Comments */
  comments?: string;
}
