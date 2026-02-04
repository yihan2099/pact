import {
  ClawboyAgentAdapterABI,
  ERC8004IdentityRegistryABI,
  getContractAddresses,
} from '@clawboy/contracts';
import { getPublicClient } from '../client/public-client';

/**
 * Get default chain ID from environment
 */
function getDefaultChainId(): number {
  return parseInt(process.env.CHAIN_ID || '84532', 10);
}

/**
 * Get ClawboyAgentAdapter contract address
 */
export function getAgentAdapterAddress(chainId?: number): `0x${string}` {
  const addresses = getContractAddresses(chainId || getDefaultChainId());
  return addresses.agentAdapter;
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
    address: addresses.agentAdapter,
    abi: ClawboyAgentAdapterABI,
    functionName: 'isRegistered',
    args: [address],
  }) as Promise<boolean>;
}

/**
 * Get agent ID for a wallet address
 */
export async function getAgentId(address: `0x${string}`, chainId?: number): Promise<bigint> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  return publicClient.readContract({
    address: addresses.agentAdapter,
    abi: ClawboyAgentAdapterABI,
    functionName: 'getAgentId',
    args: [address],
  }) as Promise<bigint>;
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
    address: addresses.agentAdapter,
    abi: ClawboyAgentAdapterABI,
    functionName: 'getVoteWeight',
    args: [address],
  }) as Promise<bigint>;
}

/**
 * Get agent's reputation summary from ERC-8004 feedback
 */
export async function getAgentReputationSummary(
  address: `0x${string}`,
  chainId?: number
): Promise<{
  taskWins: bigint;
  disputeWins: bigint;
  disputeLosses: bigint;
  totalReputation: bigint;
}> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  const result = await publicClient.readContract({
    address: addresses.agentAdapter,
    abi: ClawboyAgentAdapterABI,
    functionName: 'getReputationSummary',
    args: [address],
  });

  // Viem returns result as tuple array
  const [taskWins, disputeWins, disputeLosses, totalReputation] = result as [
    bigint,
    bigint,
    bigint,
    bigint,
  ];

  return {
    taskWins,
    disputeWins,
    disputeLosses,
    totalReputation,
  };
}

/**
 * Get the ERC-8004 Identity Registry address
 */
export async function getIdentityRegistryAddress(chainId?: number): Promise<`0x${string}`> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  return publicClient.readContract({
    address: addresses.agentAdapter,
    abi: ClawboyAgentAdapterABI,
    functionName: 'getIdentityRegistry',
    args: [],
  }) as Promise<`0x${string}`>;
}

/**
 * Get the ERC-8004 Reputation Registry address
 */
export async function getReputationRegistryAddress(chainId?: number): Promise<`0x${string}`> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  return publicClient.readContract({
    address: addresses.agentAdapter,
    abi: ClawboyAgentAdapterABI,
    functionName: 'getReputationRegistry',
    args: [],
  }) as Promise<`0x${string}`>;
}

/**
 * Get agent's URI from the ERC-8004 Identity Registry
 * Returns the IPFS URI (ipfs://CID) for the agent's profile
 */
export async function getAgentURI(
  address: `0x${string}`,
  chainId?: number
): Promise<string | null> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  // First get the agent ID
  const agentId = (await publicClient.readContract({
    address: addresses.agentAdapter,
    abi: ClawboyAgentAdapterABI,
    functionName: 'getAgentId',
    args: [address],
  })) as bigint;

  if (agentId === 0n) {
    return null;
  }

  // Then get the agent URI from the identity registry
  const agentURI = (await publicClient.readContract({
    address: addresses.identityRegistry,
    abi: ERC8004IdentityRegistryABI,
    functionName: 'getAgentURI',
    args: [agentId],
  })) as string;

  return agentURI || null;
}
