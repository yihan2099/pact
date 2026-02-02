import type { TaskListItem, OnChainSubmission } from '../task/task';
import type { AgentListItem } from '../agent/agent';
import type { DisputeListItem, DisputeStatus } from '../dispute';

/**
 * MCP tool response types
 * Updated for competitive task system with optimistic verification
 */

// Task tool responses
export interface ListTasksResponse {
  tasks: TaskListItem[];
  total: number;
  hasMore: boolean;
}

export interface GetTaskResponse {
  id: string;
  title: string;
  description: string;
  status: string;
  bountyAmount: string;
  bountyToken: string;
  creator: string;
  deadline: string | null;
  tags: string[];
  deliverables: Array<{
    type: string;
    description: string;
    format?: string;
  }>;
  requirements?: Array<{
    type: string;
    value: string | number;
    required: boolean;
  }>;
  /** All submissions for this task */
  submissions?: SubmissionInfo[];
  /** Number of submissions */
  submissionCount: number;
  /** Selected winner address (if any) */
  winnerAddress?: string;
  /** When winner was selected */
  selectedAt?: string;
  /** Challenge deadline (48h after selection) */
  challengeDeadline?: string;
  createdAt: string;
}

export interface SubmissionInfo {
  agent: string;
  submissionCid: string;
  submittedAt: string;
  updatedAt: string;
  isWinner: boolean;
}

export interface CreateTaskResponse {
  taskId: string;
  specificationCid: string;
  txHash: string;
  explorerUrl: string;
}

export interface CancelTaskResponse {
  taskId: string;
  txHash: string;
  refundAmount: string;
}

// Agent submission responses
export interface SubmitWorkResponse {
  taskId: string;
  submissionCid: string;
  txHash: string;
  isUpdate: boolean;
}

export interface GetMySubmissionsResponse {
  submissions: Array<{
    taskId: string;
    taskTitle: string;
    taskStatus: string;
    submissionCid: string;
    submittedAt: string;
    updatedAt: string;
    isWinner: boolean;
    bountyAmount: string;
  }>;
  total: number;
  hasMore: boolean;
}

// Creator selection responses
export interface SelectWinnerResponse {
  taskId: string;
  winnerAddress: string;
  challengeDeadline: string;
  txHash: string;
}

export interface RejectAllResponse {
  taskId: string;
  refundAmount: string;
  txHash: string;
}

export interface FinalizeTaskResponse {
  taskId: string;
  winnerAddress: string;
  bountyReleased: string;
  txHash: string;
}

// Dispute responses
export interface StartDisputeResponse {
  disputeId: string;
  taskId: string;
  stake: string;
  votingDeadline: string;
  txHash: string;
}

export interface SubmitVoteResponse {
  disputeId: string;
  voteWeight: number;
  txHash: string;
}

export interface GetDisputeResponse {
  id: string;
  taskId: string;
  disputer: string;
  disputeStake: string;
  votingDeadline: string;
  status: DisputeStatus;
  disputerWon: boolean | null;
  votesForDisputer: string;
  votesAgainstDisputer: string;
  votes?: Array<{
    voter: string;
    supportsDisputer: boolean;
    weight: number;
    votedAt: string;
  }>;
  createdAt: string;
}

export interface ListDisputesResponse {
  disputes: DisputeListItem[];
  total: number;
  hasMore: boolean;
}

export interface ResolveDisputeResponse {
  disputeId: string;
  taskId: string;
  disputerWon: boolean;
  txHash: string;
}

// Utility tool responses
export interface GetBalanceResponse {
  address: string;
  balance: string;
  symbol: string;
  decimals: number;
}

export interface GetProfileResponse {
  address: string;
  name: string;
  reputation: string;
  tasksWon: number;
  disputesWon: number;
  disputesLost: number;
  skills: string[];
  /** Calculated vote weight for disputes */
  voteWeight: number;
}

export interface GetVoteWeightResponse {
  address: string;
  reputation: string;
  voteWeight: number;
}

// Error response
export interface ToolErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
