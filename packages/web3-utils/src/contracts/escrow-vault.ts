import { EscrowVaultABI, getContractAddresses } from '@porternetwork/contracts';
import { getPublicClient } from '../client/public-client';

/**
 * Get EscrowVault contract address
 */
export function getEscrowVaultAddress(chainId: number = 84532): `0x${string}` {
  const addresses = getContractAddresses(chainId);
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
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId || 84532);

  const [token, amount] = await publicClient.readContract({
    address: addresses.escrowVault,
    abi: EscrowVaultABI,
    functionName: 'getBalance',
    args: [taskId],
  }) as [`0x${string}`, bigint];

  return { token, amount };
}
