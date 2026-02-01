import type { TaskStatus } from './task-status';

/**
 * On-chain task data from the TaskManager contract
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

  /** Agent address if claimed */
  claimedBy: `0x${string}` | null;

  /** Timestamp when claimed */
  claimedAt: bigint | null;

  /** Submission CID if work submitted */
  submissionCid: string | null;

  /** Block number when created */
  createdAtBlock: bigint;

  /** Deadline timestamp (0 if no deadline) */
  deadline: bigint;
}

/**
 * Full task including off-chain specification
 */
export interface Task extends OnChainTask {
  /** Resolved task specification from IPFS */
  specification: import('./task-specification').TaskSpecification;
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
