import {
  createWalletClient,
  http,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChain, getDefaultRpcUrl } from './public-client';

/**
 * Create a wallet client from a private key
 */
export function createWalletFromPrivateKey(
  privateKey: `0x${string}`,
  chainId: number = 84532,
  rpcUrl?: string
): WalletClient<Transport, Chain, Account> {
  const account = privateKeyToAccount(privateKey);
  const chain = getChain(chainId);
  const url = rpcUrl || getDefaultRpcUrl(chainId);

  return createWalletClient({
    account,
    chain,
    transport: http(url),
  });
}

/**
 * Get wallet address from private key
 */
export function getAddressFromPrivateKey(privateKey: `0x${string}`): `0x${string}` {
  const account = privateKeyToAccount(privateKey);
  return account.address;
}

/**
 * Sign a message with a private key
 */
export async function signMessage(
  privateKey: `0x${string}`,
  message: string
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);
  return account.signMessage({ message });
}

/**
 * Sign typed data (EIP-712)
 */
export async function signTypedData(
  privateKey: `0x${string}`,
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  },
  types: Record<string, Array<{ name: string; type: string }>>,
  primaryType: string,
  message: Record<string, unknown>
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);
  return account.signTypedData({
    domain,
    types,
    primaryType,
    message,
  });
}
