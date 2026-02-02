/**
 * MCP tool input types
 * These define the parameters for each MCP tool
 * Updated for competitive task system with optimistic verification
 */

// Task tools
export interface ListTasksInput {
  /** Filter by status */
  status?: 'open' | 'in_review' | 'completed' | 'disputed' | 'refunded' | 'cancelled';
  /** Filter by tags */
  tags?: string[];
  /** Filter by minimum bounty (in ETH) */
  minBounty?: string;
  /** Filter by maximum bounty (in ETH) */
  maxBounty?: string;
  /** Filter by creator address */
  creator?: string;
  /** Filter by winner address */
  winner?: string;
  /** Number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort by field */
  sortBy?: 'bounty' | 'createdAt' | 'deadline' | 'submissionCount';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

export interface GetTaskInput {
  /** Task ID to retrieve */
  taskId: string;
  /** Include all submissions */
  includeSubmissions?: boolean;
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

// Agent submission tools
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
  /** Notes for the creator */
  creatorNotes?: string;
}

export interface GetMySubmissionsInput {
  /** Filter by task status */
  taskStatus?: 'open' | 'in_review' | 'completed' | 'disputed' | 'refunded';
  /** Only show winning submissions */
  isWinner?: boolean;
  /** Number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// Creator selection tools
export interface SelectWinnerInput {
  /** Task ID */
  taskId: string;
  /** Address of the winning agent */
  winnerAddress: string;
  /** Optional feedback for the winner */
  feedback?: string;
}

export interface RejectAllInput {
  /** Task ID */
  taskId: string;
  /** Reason for rejecting all submissions */
  reason: string;
}

export interface FinalizeTaskInput {
  /** Task ID to finalize (after 48h challenge window) */
  taskId: string;
}

// Dispute tools
export interface StartDisputeInput {
  /** Task ID to dispute */
  taskId: string;
  /** Reason for the dispute */
  reason: string;
  /** Evidence CID (IPFS) */
  evidenceCid?: string;
}

export interface SubmitVoteInput {
  /** Dispute ID */
  disputeId: string;
  /** Whether to vote in favor of the disputer */
  supportsDisputer: boolean;
  /** Optional reasoning for the vote */
  reasoning?: string;
}

export interface GetDisputeInput {
  /** Dispute ID to retrieve */
  disputeId: string;
  /** Include all votes */
  includeVotes?: boolean;
}

export interface ListDisputesInput {
  /** Filter by status */
  status?: 'active' | 'resolved' | 'cancelled';
  /** Filter by task ID */
  taskId?: string;
  /** Filter by disputer address */
  disputer?: string;
  /** Number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface ResolveDisputeInput {
  /** Dispute ID to resolve */
  disputeId: string;
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

export interface GetVoteWeightInput {
  /** Agent address to check vote weight */
  address?: string;
}
