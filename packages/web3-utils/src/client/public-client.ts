import {
  createPublicClient,
  http,
  type PublicClient,
  type Chain,
  type Transport,
  defineChain,
} from 'viem';
import { baseSepolia, base } from 'viem/chains';

let publicClient: PublicClient<Transport, Chain> | null = null;

/**
 * Local Anvil chain configuration
 */
const localAnvil = defineChain({
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
});

/**
 * Get the chain configuration based on chain ID
 */
export function getChain(chainId: number): Chain {
  switch (chainId) {
    case 31337:
      return localAnvil;
    case 84532:
      return baseSepolia;
    case 8453:
      return base;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

/**
 * Get or create a public client for read operations
 */
export function getPublicClient(
  chainId: number = 84532,
  rpcUrl?: string
): PublicClient<Transport, Chain> {
  if (publicClient) {
    return publicClient;
  }

  const chain = getChain(chainId);
  const url = rpcUrl || getDefaultRpcUrl(chainId);

  publicClient = createPublicClient({
    chain,
    transport: http(url),
  });

  return publicClient;
}

/**
 * Get default RPC URL for a chain
 */
export function getDefaultRpcUrl(chainId: number): string {
  switch (chainId) {
    case 31337:
      return process.env.RPC_URL || 'http://127.0.0.1:8545';
    case 84532:
      return 'https://sepolia.base.org';
    case 8453:
      return 'https://mainnet.base.org';
    default:
      throw new Error(`No default RPC URL for chain ID: ${chainId}`);
  }
}

/**
 * Reset the public client (useful for testing)
 */
export function resetPublicClient(): void {
  publicClient = null;
}

/**
 * Get current block number
 */
export async function getBlockNumber(chainId?: number): Promise<bigint> {
  const client = getPublicClient(chainId);
  return client.getBlockNumber();
}

/**
 * Get balance for an address
 */
export async function getBalance(
  address: `0x${string}`,
  chainId?: number
): Promise<bigint> {
  const client = getPublicClient(chainId);
  return client.getBalance({ address });
}

/**
 * Wait for a transaction to be confirmed
 */
export async function waitForTransaction(
  hash: `0x${string}`,
  chainId?: number
): Promise<{
  blockNumber: bigint;
  status: 'success' | 'reverted';
}> {
  const client = getPublicClient(chainId);
  const receipt = await client.waitForTransactionReceipt({ hash });

  return {
    blockNumber: receipt.blockNumber,
    status: receipt.status,
  };
}
