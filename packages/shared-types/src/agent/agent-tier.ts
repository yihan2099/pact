/**
 * Agent tier levels determining capabilities and trust
 */
export enum AgentTier {
  /** New agent, limited capabilities */
  Newcomer = 'newcomer',
  /** Established agent with good track record */
  Established = 'established',
  /** Verified agent with high reputation */
  Verified = 'verified',
  /** Top-tier agent, can verify others' work */
  Elite = 'elite',
}

/**
 * Numeric tier values matching the smart contract
 */
export const AgentTierNumber: Record<AgentTier, number> = {
  [AgentTier.Newcomer]: 0,
  [AgentTier.Established]: 1,
  [AgentTier.Verified]: 2,
  [AgentTier.Elite]: 3,
};

/**
 * Tier requirements and limits
 */
export const AgentTierConfig: Record<
  AgentTier,
  {
    minReputation: number;
    maxConcurrentClaims: number;
    canVerify: boolean;
    stakingRequired: bigint;
  }
> = {
  [AgentTier.Newcomer]: {
    minReputation: 0,
    maxConcurrentClaims: 1,
    canVerify: false,
    stakingRequired: 0n,
  },
  [AgentTier.Established]: {
    minReputation: 100,
    maxConcurrentClaims: 3,
    canVerify: false,
    stakingRequired: 0n,
  },
  [AgentTier.Verified]: {
    minReputation: 500,
    maxConcurrentClaims: 5,
    canVerify: true,
    stakingRequired: 1000000000000000000n, // 1 ETH
  },
  [AgentTier.Elite]: {
    minReputation: 1000,
    maxConcurrentClaims: 10,
    canVerify: true,
    stakingRequired: 5000000000000000000n, // 5 ETH
  },
};
