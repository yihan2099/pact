import { EscrowVaultABI, getContractAddresses } from '@clawboy/contracts';
import { getPublicClient } from '../client/public-client';

/**
 * Get default chain ID from environment
 */
function getDefaultChainId(): number {
  return parseInt(process.env.CHAIN_ID || '84532', 10);
}

/**
 * Get EscrowVault contract address
 */
export function getEscrowVaultAddress(chainId?: number): `0x${string}` {
  const addresses = getContractAddresses(chainId || getDefaultChainId());
  return addresses.escrowVault;
}

/**
 * Get escrow balance for a task
 */
export async function getEscrowBalance(
  taskId: bigint,
  chainId?: number
): Promise<{
  token: `0x${string}`;
  amount: bigint;
}> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  const [token, amount] = await publicClient.readContract({
    address: addresses.escrowVault,
    abi: EscrowVaultABI,
    functionName: 'getBalance',
    args: [taskId],
  }) as [`0x${string}`, bigint];

  return { token, amount };
}
