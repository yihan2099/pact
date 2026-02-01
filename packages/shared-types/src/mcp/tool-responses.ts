import type { TaskListItem } from '../task/task';
import type { AgentListItem } from '../agent/agent';
import type { ClaimWithSubmission, ClaimStatus } from '../claim/claim';
import type { PendingVerification, VerdictOutcome } from '../verification/verdict';

/**
 * MCP tool response types
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
  claimedBy?: string;
  claimedAt?: string;
  submissionCid?: string;
  createdAt: string;
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

// Agent tool responses
export interface ClaimTaskResponse {
  taskId: string;
  claimId: string;
  deadline: string | null;
  txHash: string;
}

export interface SubmitWorkResponse {
  taskId: string;
  submissionCid: string;
  txHash: string;
}

export interface GetMyClaimsResponse {
  claims: Array<{
    claimId: string;
    taskId: string;
    taskTitle: string;
    status: ClaimStatus;
    claimedAt: string;
    deadline: string | null;
    bountyAmount: string;
  }>;
  total: number;
}

// Verifier tool responses
export interface ListPendingVerificationsResponse {
  verifications: PendingVerification[];
  total: number;
  hasMore: boolean;
}

export interface SubmitVerdictResponse {
  taskId: string;
  claimId: string;
  verdictId: string;
  outcome: VerdictOutcome;
  feedbackCid: string;
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
  tier: string;
  reputation: string;
  tasksCompleted: number;
  successRate: number;
  skills: string[];
  isVerifier: boolean;
  stakedAmount: string;
}

// Error response
export interface ToolErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
