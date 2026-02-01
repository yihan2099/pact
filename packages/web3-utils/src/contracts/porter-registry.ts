import { PorterRegistryABI, getContractAddresses } from '@porternetwork/contracts';
import { getPublicClient } from '../client/public-client';
import type { AgentTier } from '@porternetwork/shared-types';

/**
 * Get PorterRegistry contract address
 */
export function getPorterRegistryAddress(chainId: number = 84532): `0x${string}` {
  const addresses = getContractAddresses(chainId);
  return addresses.porterRegistry;
}

/**
 * Check if an address is registered as an agent
 */
export async function isAgentRegistered(
  address: `0x${string}`,
  chainId?: number
): Promise<boolean> {
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId || 84532);

  return publicClient.readContract({
    address: addresses.porterRegistry,
    abi: PorterRegistryABI,
    functionName: 'isRegistered',
    args: [address],
  }) as Promise<boolean>;
}

/**
 * Get agent data from contract
 */
export async function getAgentData(
  address: `0x${string}`,
  chainId?: number
): Promise<{
  tier: number;
  reputation: bigint;
  tasksCompleted: bigint;
  tasksFailed: bigint;
  stakedAmount: bigint;
  profileCid: string;
  registeredAt: bigint;
  isActive: boolean;
}> {
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId || 84532);

  const result = await publicClient.readContract({
    address: addresses.porterRegistry,
    abi: PorterRegistryABI,
    functionName: 'getAgent',
    args: [address],
  });

  // Viem returns tuple as array
  const agent = result as unknown as readonly [
    number,
    bigint,
    bigint,
    bigint,
    bigint,
    string,
    bigint,
    boolean
  ];

  return {
    tier: agent[0],
    reputation: agent[1],
    tasksCompleted: agent[2],
    tasksFailed: agent[3],
    stakedAmount: agent[4],
    profileCid: agent[5],
    registeredAt: agent[6],
    isActive: agent[7],
  };
}

/**
 * Get agent's staked amount
 */
export async function getAgentStake(
  address: `0x${string}`,
  chainId?: number
): Promise<bigint> {
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId || 84532);

  return publicClient.readContract({
    address: addresses.porterRegistry,
    abi: PorterRegistryABI,
    functionName: 'getStake',
    args: [address],
  }) as Promise<bigint>;
}

/**
 * Convert contract tier number to AgentTier enum
 */
export function contractTierToAgentTier(tier: number): AgentTier {
  const tierMap: Record<number, AgentTier> = {
    0: 'newcomer' as AgentTier,
    1: 'established' as AgentTier,
    2: 'verified' as AgentTier,
    3: 'elite' as AgentTier,
  };

  return tierMap[tier] ?? ('newcomer' as AgentTier);
}
