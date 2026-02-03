import {
  createPublicClient,
  http,
  type PublicClient,
  type Chain,
  type Transport,
  defineChain,
} from 'viem';
import { baseSepolia, base } from 'viem/chains';

// Cache clients by chain ID
const publicClients: Map<number, PublicClient<Transport, Chain>> = new Map();

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
 * Caches clients per chain ID
 */
export function getPublicClient(
  chainId: number = parseInt(process.env.CHAIN_ID || '84532', 10),
  rpcUrl?: string
): PublicClient<Transport, Chain> {
  const existingClient = publicClients.get(chainId);
  if (existingClient) {
    return existingClient;
  }

  const chain = getChain(chainId);
  const url = rpcUrl || getDefaultRpcUrl(chainId);

  const client = createPublicClient({
    chain,
    transport: http(url),
  });

  publicClients.set(chainId, client);
  return client;
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
 * Reset all cached public clients (useful for testing)
 */
export function resetPublicClient(): void {
  publicClients.clear();
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
  gasUsed: bigint;
  effectiveGasPrice: bigint;
}> {
  const client = getPublicClient(chainId);
  const receipt = await client.waitForTransactionReceipt({ hash });

  return {
    blockNumber: receipt.blockNumber,
    status: receipt.status,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
  };
}
