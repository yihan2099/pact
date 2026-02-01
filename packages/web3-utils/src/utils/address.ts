import { isAddress, getAddress, checksumAddress } from 'viem';

/**
 * Validate an Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

/**
 * Normalize an address to checksummed format
 */
export function normalizeAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return getAddress(address);
}

/**
 * Get checksum address
 */
export function toChecksumAddress(address: string): `0x${string}` {
  return checksumAddress(address as `0x${string}`);
}

/**
 * Compare two addresses (case-insensitive)
 */
export function addressesEqual(a: string, b: string): boolean {
  if (!isAddress(a) || !isAddress(b)) {
    return false;
  }
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Shorten address for display (e.g., 0x1234...5678)
 */
export function shortenAddress(
  address: string,
  prefixLength: number = 6,
  suffixLength: number = 4
): string {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

/**
 * Check if address is zero address
 */
export function isZeroAddress(address: string): boolean {
  return (
    isAddress(address) &&
    address.toLowerCase() === '0x0000000000000000000000000000000000000000'
  );
}

/**
 * Zero address constant
 */
export const ZERO_ADDRESS: `0x${string}` =
  '0x0000000000000000000000000000000000000000';
