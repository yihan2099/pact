/**
 * Dispute status enum matching the smart contract states
 */
export enum DisputeStatus {
  /** Dispute is active and accepting votes */
  Active = 'active',
  /** Dispute has been resolved */
  Resolved = 'resolved',
  /** Dispute was cancelled */
  Cancelled = 'cancelled',
}

/**
 * Numeric status values matching the smart contract
 */
export const DisputeStatusNumber: Record<DisputeStatus, number> = {
  [DisputeStatus.Active]: 0,
  [DisputeStatus.Resolved]: 1,
  [DisputeStatus.Cancelled]: 2,
};

/**
 * On-chain dispute data from the DisputeResolver contract
 */
export interface OnChainDispute {
  /** Unique dispute ID (uint256) */
  id: bigint;

  /** Task ID this dispute is for */
  taskId: bigint;

  /** Address of the agent who raised the dispute */
  disputer: `0x${string}`;

  /** ETH stake posted by disputer */
  disputeStake: bigint;

  /** Timestamp when voting ends */
  votingDeadline: bigint;

  /** Current dispute status */
  status: DisputeStatus;

  /** Whether disputer won (null if not resolved) */
  disputerWon: boolean | null;

  /** Weighted votes supporting disputer */
  votesForDisputer: bigint;

  /** Weighted votes against disputer */
  votesAgainstDisputer: bigint;
}

/**
 * On-chain vote data
 */
export interface OnChainVote {
  /** Voter's wallet address */
  voter: `0x${string}`;

  /** Whether vote supports disputer */
  supportsDisputer: boolean;

  /** Vote weight based on reputation */
  weight: bigint;

  /** Timestamp when voted */
  timestamp: bigint;
}

/**
 * Dispute list item for display
 */
export interface DisputeListItem {
  id: string;
  taskId: string;
  disputerAddress: `0x${string}`;
  disputeStake: string;
  votingDeadline: string;
  status: DisputeStatus;
  disputerWon: boolean | null;
  votesForDisputer: string;
  votesAgainstDisputer: string;
  createdAt: string;
}

/**
 * Parameters for starting a dispute
 */
export interface StartDisputeParams {
  taskId: bigint;
}

/**
 * Parameters for submitting a vote
 */
export interface SubmitVoteParams {
  disputeId: bigint;
  supportsDisputer: boolean;
}

/**
 * Calculate required dispute stake (1% of bounty, min 0.01 ETH)
 */
export function calculateDisputeStake(bountyAmount: bigint): bigint {
  const minStake = BigInt('10000000000000000'); // 0.01 ETH in wei
  const percentStake = bountyAmount / BigInt(100);
  return percentStake > minStake ? percentStake : minStake;
}
