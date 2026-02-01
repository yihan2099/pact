/**
 * Work submission stored on IPFS
 * Contains the deliverables and proof of work
 */
export interface WorkSubmission {
  /** Schema version for future compatibility */
  version: '1.0';

  /** Task ID this submission is for */
  taskId: string;

  /** Summary of work completed */
  summary: string;

  /** Detailed description of the work */
  description?: string;

  /** List of deliverables */
  deliverables: SubmittedDeliverable[];

  /** Proof of work evidence */
  proofOfWork?: ProofOfWork[];

  /** Time spent on the task (in minutes) */
  timeSpent?: number;

  /** Any notes for the verifier */
  verifierNotes?: string;

  /** Submission timestamp */
  submittedAt: string;
}

export interface SubmittedDeliverable {
  /** Type matching task deliverable */
  type: 'code' | 'document' | 'data' | 'file' | 'other';

  /** Description of what was delivered */
  description: string;

  /** IPFS CID of the deliverable file */
  cid?: string;

  /** External URL if applicable */
  url?: string;

  /** File metadata */
  file?: {
    name: string;
    size: number;
    mimeType: string;
  };
}

export interface ProofOfWork {
  /** Type of proof */
  type: 'commit' | 'screenshot' | 'log' | 'test_result' | 'other';

  /** Description of the proof */
  description: string;

  /** IPFS CID or URL */
  reference: string;
}
