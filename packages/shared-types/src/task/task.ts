import type { TaskStatus } from './task-status';

/**
 * On-chain task data from the TaskManager contract
 * Updated for competitive task system
 */
export interface OnChainTask {
  /** Unique task ID (uint256) */
  id: bigint;

  /** Creator's wallet address */
  creator: `0x${string}`;

  /** Current task status */
  status: TaskStatus;

  /** Bounty amount in wei */
  bountyAmount: bigint;

  /** Token address for bounty (address(0) for ETH) */
  bountyToken: `0x${string}`;

  /** IPFS CID for task specification */
  specificationCid: string;

  /** Block number when created */
  createdAtBlock: bigint;

  /** Deadline timestamp for submissions (0 if no deadline) */
  deadline: bigint;

  /** Selected winner address (null if not yet selected or rejected all) */
  selectedWinner: `0x${string}` | null;

  /** Timestamp when winner was selected */
  selectedAt: bigint | null;

  /** Timestamp when challenge window ends */
  challengeDeadline: bigint | null;
}

/**
 * On-chain submission data
 */
export interface OnChainSubmission {
  /** Agent's wallet address */
  agent: `0x${string}`;

  /** IPFS CID for submission content */
  submissionCid: string;

  /** Timestamp when submitted */
  submittedAt: bigint;

  /** Timestamp when last updated */
  updatedAt: bigint;
}

/**
 * Full task including off-chain specification
 */
export interface Task extends OnChainTask {
  /** Resolved task specification from IPFS */
  specification: import('./task-specification').TaskSpecification;

  /** List of submissions for this task */
  submissions?: OnChainSubmission[];

  /** Total submission count */
  submissionCount?: number;
}

/**
 * Task list item for display (minimal data)
 */
export interface TaskListItem {
  id: string;
  title: string;
  bountyAmount: string;
  bountyToken: `0x${string}`;
  status: TaskStatus;
  creatorAddress: `0x${string}`;
  deadline: string | null;
  tags: string[];
  createdAt: string;
  submissionCount: number;
  winnerAddress: string | null;
  challengeDeadline: string | null;
}

/**
 * Parameters for creating a new task
 */
export interface CreateTaskParams {
  specification: import('./task-specification').TaskSpecification;
  bountyAmount: bigint;
  bountyToken?: `0x${string}`;
  deadline?: bigint;
}

/**
 * Parameters for submitting work
 */
export interface SubmitWorkParams {
  taskId: bigint;
  submissionCid: string;
}

/**
 * Parameters for selecting a winner
 */
export interface SelectWinnerParams {
  taskId: bigint;
  winnerAddress: `0x${string}`;
}

/**
 * Parameters for rejecting all submissions
 */
export interface RejectAllParams {
  taskId: bigint;
  reason: string;
}
