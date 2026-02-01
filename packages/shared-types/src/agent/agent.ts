import type { AgentTier } from './agent-tier';

/**
 * On-chain agent data from the PorterRegistry contract
 */
export interface OnChainAgent {
  /** Agent's wallet address */
  address: `0x${string}`;

  /** Current tier */
  tier: AgentTier;

  /** Reputation score */
  reputation: bigint;

  /** Total tasks completed */
  tasksCompleted: bigint;

  /** Total tasks failed/disputed */
  tasksFailed: bigint;

  /** Amount staked */
  stakedAmount: bigint;

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
  tier: AgentTier;
  reputation: string;
  tasksCompleted: number;
  successRate: number;
  skills: string[];
}

/**
 * Parameters for registering a new agent
 */
export interface RegisterAgentParams {
  profile: import('./agent-profile').AgentProfile;
  initialStake?: bigint;
}
