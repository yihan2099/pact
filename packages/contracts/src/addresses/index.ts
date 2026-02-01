export { BASE_SEPOLIA_ADDRESSES, BASE_SEPOLIA_CHAIN_ID } from './base-sepolia';
export { BASE_MAINNET_ADDRESSES, BASE_MAINNET_CHAIN_ID } from './base-mainnet';

import { BASE_SEPOLIA_ADDRESSES, BASE_SEPOLIA_CHAIN_ID } from './base-sepolia';
import { BASE_MAINNET_ADDRESSES, BASE_MAINNET_CHAIN_ID } from './base-mainnet';

export type ContractAddresses = typeof BASE_SEPOLIA_ADDRESSES;

/**
 * Get contract addresses for a given chain ID
 */
export function getContractAddresses(chainId: number): ContractAddresses {
  switch (chainId) {
    case BASE_SEPOLIA_CHAIN_ID:
      return BASE_SEPOLIA_ADDRESSES;
    case BASE_MAINNET_CHAIN_ID:
      return BASE_MAINNET_ADDRESSES;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

/**
 * Check if a chain ID is supported
 */
export function isSupportedChain(chainId: number): boolean {
  return chainId === BASE_SEPOLIA_CHAIN_ID || chainId === BASE_MAINNET_CHAIN_ID;
}
