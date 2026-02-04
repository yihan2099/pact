import { ERC8004ReputationRegistryABI, getContractAddresses } from '@clawboy/contracts';
import { getPublicClient } from '../client/public-client';

/**
 * Get default chain ID from environment
 */
function getDefaultChainId(): number {
  return parseInt(process.env.CHAIN_ID || '84532', 10);
}

/**
 * Feedback entry from the reputation registry
 */
export interface FeedbackEntry {
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  isRevoked: boolean;
}

/**
 * Feedback summary from the reputation registry
 */
export interface FeedbackSummary {
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
}

/**
 * Get feedback summary for an agent by tags
 */
export async function getFeedbackSummary(
  agentId: bigint,
  tag1: string,
  tag2: string,
  clientAddresses: `0x${string}`[] = [],
  chainId?: number
): Promise<FeedbackSummary> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  const result = await publicClient.readContract({
    address: addresses.reputationRegistry,
    abi: ERC8004ReputationRegistryABI,
    functionName: 'getSummary',
    args: [agentId, clientAddresses, tag1, tag2],
  });

  const [count, summaryValue, summaryValueDecimals] = result as [bigint, bigint, number];

  return {
    count,
    summaryValue,
    summaryValueDecimals,
  };
}

/**
 * Get all client addresses that have given feedback to an agent
 */
export async function getFeedbackClients(
  agentId: bigint,
  chainId?: number
): Promise<`0x${string}`[]> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  return publicClient.readContract({
    address: addresses.reputationRegistry,
    abi: ERC8004ReputationRegistryABI,
    functionName: 'getClients',
    args: [agentId],
  }) as Promise<`0x${string}`[]>;
}

/**
 * Get the last feedback index for a client-agent pair
 */
export async function getLastFeedbackIndex(
  agentId: bigint,
  clientAddress: `0x${string}`,
  chainId?: number
): Promise<bigint> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  return publicClient.readContract({
    address: addresses.reputationRegistry,
    abi: ERC8004ReputationRegistryABI,
    functionName: 'getLastIndex',
    args: [agentId, clientAddress],
  }) as Promise<bigint>;
}

/**
 * Read a specific feedback entry
 */
export async function readFeedback(
  agentId: bigint,
  clientAddress: `0x${string}`,
  feedbackIndex: bigint,
  chainId?: number
): Promise<FeedbackEntry> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  const result = await publicClient.readContract({
    address: addresses.reputationRegistry,
    abi: ERC8004ReputationRegistryABI,
    functionName: 'readFeedback',
    args: [agentId, clientAddress, feedbackIndex],
  });

  const [value, valueDecimals, tag1, tag2, isRevoked] = result as [
    bigint,
    number,
    string,
    string,
    boolean,
  ];

  return {
    value,
    valueDecimals,
    tag1,
    tag2,
    isRevoked,
  };
}

/**
 * Get feedback count for specific tags
 */
export async function getFeedbackCount(
  agentId: bigint,
  tag1: string,
  tag2: string,
  chainId?: number
): Promise<bigint> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  return publicClient.readContract({
    address: addresses.reputationRegistry,
    abi: ERC8004ReputationRegistryABI,
    functionName: 'getFeedbackCount',
    args: [agentId, tag1, tag2],
  }) as Promise<bigint>;
}

/**
 * Get all feedback entries for an agent (paginated)
 */
export async function getAllFeedback(
  agentId: bigint,
  limit: number = 50,
  chainId?: number
): Promise<Array<FeedbackEntry & { clientAddress: `0x${string}`; feedbackIndex: bigint }>> {
  const resolvedChainId = chainId || getDefaultChainId();

  // Get all clients who have given feedback
  const clients = await getFeedbackClients(agentId, resolvedChainId);

  const allFeedback: Array<
    FeedbackEntry & { clientAddress: `0x${string}`; feedbackIndex: bigint }
  > = [];

  for (const clientAddress of clients) {
    const lastIndex = await getLastFeedbackIndex(agentId, clientAddress, resolvedChainId);

    // Read all feedback from this client (indices are 1-based in ERC-8004)
    for (let i = 1n; i <= lastIndex && allFeedback.length < limit; i++) {
      try {
        const feedback = await readFeedback(agentId, clientAddress, i, resolvedChainId);
        allFeedback.push({
          ...feedback,
          clientAddress,
          feedbackIndex: i,
        });
      } catch {
        // Skip if feedback doesn't exist or is inaccessible
        continue;
      }
    }

    if (allFeedback.length >= limit) break;
  }

  return allFeedback;
}
