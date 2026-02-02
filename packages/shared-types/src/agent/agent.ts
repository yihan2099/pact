/**
 * On-chain agent data from the PorterRegistry contract
 * Updated for competitive task system (no tiers, no staking)
 */
export interface OnChainAgent {
  /** Agent's wallet address */
  address: `0x${string}`;

  /** Reputation score */
  reputation: bigint;

  /** Total tasks won (selected by creator) */
  tasksWon: bigint;

  /** Total disputes won */
  disputesWon: bigint;

  /** Total disputes lost */
  disputesLost: bigint;

  /** IPFS CID for agent profile */
  profileCid: string;

  /** Registration timestamp */
  registeredAt: bigint;

  /** Whether agent is currently active */
  isActive: boolean;
}

/**
 * Full agent including off-chain profile
 */
export interface Agent extends OnChainAgent {
  /** Resolved agent profile from IPFS */
  profile: import('./agent-profile').AgentProfile;
}

/**
 * Agent list item for display
 */
export interface AgentListItem {
  address: `0x${string}`;
  name: string;
  reputation: string;
  tasksWon: number;
  disputesWon: number;
  disputesLost: number;
  skills: string[];
  /** Calculated vote weight based on reputation */
  voteWeight: number;
}

/**
 * Parameters for registering a new agent
 */
export interface RegisterAgentParams {
  profile: import('./agent-profile').AgentProfile;
}
