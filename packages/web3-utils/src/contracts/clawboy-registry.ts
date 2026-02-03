import { ClawboyRegistryABI, getContractAddresses } from '@clawboy/contracts';
import { getPublicClient } from '../client/public-client';

/**
 * Get default chain ID from environment
 */
function getDefaultChainId(): number {
  return parseInt(process.env.CHAIN_ID || '84532', 10);
}

/**
 * Get ClawboyRegistry contract address
 */
export function getClawboyRegistryAddress(chainId?: number): `0x${string}` {
  const addresses = getContractAddresses(chainId || getDefaultChainId());
  return addresses.clawboyRegistry;
}

/**
 * Check if an address is registered as an agent
 */
export async function isAgentRegistered(
  address: `0x${string}`,
  chainId?: number
): Promise<boolean> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  return publicClient.readContract({
    address: addresses.clawboyRegistry,
    abi: ClawboyRegistryABI,
    functionName: 'isRegistered',
    args: [address],
  }) as Promise<boolean>;
}

/**
 * Get agent data from contract (updated for competitive model - no tiers)
 */
export async function getAgentData(
  address: `0x${string}`,
  chainId?: number
): Promise<{
  reputation: bigint;
  tasksWon: bigint;
  disputesWon: bigint;
  disputesLost: bigint;
  profileCid: string;
  registeredAt: bigint;
  isActive: boolean;
}> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  const result = await publicClient.readContract({
    address: addresses.clawboyRegistry,
    abi: ClawboyRegistryABI,
    functionName: 'getAgent',
    args: [address],
  });

  // Viem returns named tuple as object with ABI component names
  const agent = result as {
    reputation: bigint;
    tasksWon: bigint;
    disputesWon: bigint;
    disputesLost: bigint;
    profileCid: string;
    registeredAt: bigint;
    isActive: boolean;
  };

  return {
    reputation: agent.reputation,
    tasksWon: agent.tasksWon,
    disputesWon: agent.disputesWon,
    disputesLost: agent.disputesLost,
    profileCid: agent.profileCid,
    registeredAt: agent.registeredAt,
    isActive: agent.isActive,
  };
}

/**
 * Get agent's vote weight for disputes
 * Weight = max(1, floor(log2(reputation + 1)))
 */
export async function getAgentVoteWeight(
  address: `0x${string}`,
  chainId?: number
): Promise<bigint> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  return publicClient.readContract({
    address: addresses.clawboyRegistry,
    abi: ClawboyRegistryABI,
    functionName: 'getVoteWeight',
    args: [address],
  }) as Promise<bigint>;
}

/**
 * Get agent's reputation score
 */
export async function getAgentReputation(
  address: `0x${string}`,
  chainId?: number
): Promise<bigint> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  return publicClient.readContract({
    address: addresses.clawboyRegistry,
    abi: ClawboyRegistryABI,
    functionName: 'getReputation',
    args: [address],
  }) as Promise<bigint>;
}
