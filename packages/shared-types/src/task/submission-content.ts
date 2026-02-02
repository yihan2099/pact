/**
 * Work submission content stored on IPFS
 * Contains the actual submission data that doesn't need to be on-chain
 */
export interface WorkSubmission {
  /** Schema version for future compatibility */
  version: '1.0';

  /** Task ID this submission is for */
  taskId: string;

  /** Summary of work completed */
  summary: string;

  /** Detailed description of work */
  description?: string;

  /** Submitted deliverables */
  deliverables: SubmittedDeliverable[];

  /** Notes for the task creator */
  creatorNotes?: string;

  /** Timestamp when submitted */
  submittedAt: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface SubmittedDeliverable {
  /** Type of deliverable */
  type: 'code' | 'document' | 'data' | 'file' | 'other';

  /** Description of what was delivered */
  description: string;

  /** IPFS CID for the deliverable content */
  cid?: string;

  /** URL for external content */
  url?: string;
}

/**
 * Dispute evidence content stored on IPFS
 * Contains the evidence and reasoning for a dispute
 */
export interface DisputeEvidence {
  /** Schema version for future compatibility */
  version: '1.0';

  /** Task ID this dispute is for */
  taskId: string;

  /** Reason for the dispute */
  reason: string;

  /** Supporting evidence */
  evidence?: Array<{
    type: 'document' | 'screenshot' | 'link' | 'other';
    description: string;
    cid?: string;
    url?: string;
  }>;

  /** Timestamp when created */
  createdAt: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
