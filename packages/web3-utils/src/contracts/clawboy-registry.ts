import { ClawboyRegistryABI, getContractAddresses } from '@clawboy/contracts';
import { getPublicClient } from '../client/public-client';

/**
 * Get ClawboyRegistry contract address
 */
export function getClawboyRegistryAddress(chainId: number = 84532): `0x${string}` {
  const addresses = getContractAddresses(chainId);
  return addresses.clawboyRegistry;
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
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId || 84532);

  const result = await publicClient.readContract({
    address: addresses.clawboyRegistry,
    abi: ClawboyRegistryABI,
    functionName: 'getAgent',
    args: [address],
  });

  // Viem returns tuple as array
  const agent = result as unknown as readonly [
    bigint,  // reputation
    bigint,  // tasksWon
    bigint,  // disputesWon
    bigint,  // disputesLost
    string,  // profileCid
    bigint,  // registeredAt
    boolean  // isActive
  ];

  return {
    reputation: agent[0],
    tasksWon: agent[1],
    disputesWon: agent[2],
    disputesLost: agent[3],
    profileCid: agent[4],
    registeredAt: agent[5],
    isActive: agent[6],
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
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId || 84532);

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
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId || 84532);

  return publicClient.readContract({
    address: addresses.clawboyRegistry,
    abi: ClawboyRegistryABI,
    functionName: 'getReputation',
    args: [address],
  }) as Promise<bigint>;
}
