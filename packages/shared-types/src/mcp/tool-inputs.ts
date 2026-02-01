/**
 * MCP tool input types
 * These define the parameters for each MCP tool
 */

// Task tools
export interface ListTasksInput {
  /** Filter by status */
  status?: 'open' | 'claimed' | 'submitted' | 'completed';
  /** Filter by tags */
  tags?: string[];
  /** Filter by minimum bounty (in ETH) */
  minBounty?: string;
  /** Filter by maximum bounty (in ETH) */
  maxBounty?: string;
  /** Filter by creator address */
  creator?: string;
  /** Number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort by field */
  sortBy?: 'bounty' | 'createdAt' | 'deadline';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

export interface GetTaskInput {
  /** Task ID to retrieve */
  taskId: string;
}

export interface CreateTaskInput {
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Expected deliverables */
  deliverables: Array<{
    type: 'code' | 'document' | 'data' | 'file' | 'other';
    description: string;
    format?: string;
  }>;
  /** Bounty amount in ETH */
  bountyAmount: string;
  /** Optional deadline (ISO 8601) */
  deadline?: string;
  /** Optional tags */
  tags?: string[];
}

export interface CancelTaskInput {
  /** Task ID to cancel */
  taskId: string;
  /** Reason for cancellation */
  reason?: string;
}

// Agent tools
export interface ClaimTaskInput {
  /** Task ID to claim */
  taskId: string;
  /** Optional message to creator */
  message?: string;
}

export interface SubmitWorkInput {
  /** Task ID */
  taskId: string;
  /** Summary of work completed */
  summary: string;
  /** Detailed description */
  description?: string;
  /** Deliverables */
  deliverables: Array<{
    type: 'code' | 'document' | 'data' | 'file' | 'other';
    description: string;
    cid?: string;
    url?: string;
  }>;
  /** Notes for the verifier */
  verifierNotes?: string;
}

export interface GetMyClaimsInput {
  /** Filter by status */
  status?: 'active' | 'submitted' | 'approved' | 'rejected';
  /** Number of results */
  limit?: number;
}

// Verifier tools
export interface ListPendingVerificationsInput {
  /** Number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface SubmitVerdictInput {
  /** Task ID */
  taskId: string;
  /** Claim ID */
  claimId: string;
  /** Verdict outcome */
  outcome: 'approved' | 'rejected' | 'revision_requested';
  /** Overall score (0-100) */
  score: number;
  /** Detailed feedback */
  feedback: string;
  /** Recommendations for improvement */
  recommendations?: string[];
}

// Utility tools
export interface GetBalanceInput {
  /** Optional token address (omit for ETH) */
  tokenAddress?: string;
}

export interface GetProfileInput {
  /** Agent address (omit for self) */
  address?: string;
}
