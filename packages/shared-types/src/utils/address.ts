/**
 * Address normalization utilities
 *
 * Centralizes address handling to ensure consistent lowercase formatting
 * across the codebase. This prevents bugs caused by case mismatches in
 * address comparisons and database queries.
 */

/**
 * Ethereum address type (checksummed or lowercase)
 */
export type EthAddress = `0x${string}`;

/**
 * Normalize an Ethereum address to lowercase
 *
 * @param address - The address to normalize (any case)
 * @returns The address in lowercase
 *
 * @example
 * normalizeAddress('0xABC123...') // '0xabc123...'
 * normalizeAddress('0xabc123...') // '0xabc123...'
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Normalize an Ethereum address to lowercase with type casting
 *
 * @param address - The address to normalize
 * @returns The address as a typed EthAddress in lowercase
 */
export function normalizeEthAddress(address: string): EthAddress {
  return address.toLowerCase() as EthAddress;
}

/**
 * Compare two addresses for equality (case-insensitive)
 *
 * @param a - First address
 * @param b - Second address
 * @returns true if addresses are equal
 *
 * @example
 * addressesEqual('0xABC...', '0xabc...') // true
 */
export function addressesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Check if a string is a valid Ethereum address format
 *
 * @param address - The string to validate
 * @returns true if the string matches Ethereum address format
 *
 * @example
 * isValidAddress('0x1234567890123456789012345678901234567890') // true
 * isValidAddress('not an address') // false
 */
export function isValidAddress(address: string): address is EthAddress {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate and normalize an address
 *
 * @param address - The address to validate and normalize
 * @returns The normalized address
 * @throws Error if the address is invalid
 */
export function validateAndNormalizeAddress(address: string): EthAddress {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  return normalizeEthAddress(address);
}

/**
 * Truncate an address for display (e.g., "0x1234...5678")
 *
 * @param address - The address to truncate
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address string
 */
export function truncateAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (address.length <= startChars + endChars + 3) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Zero address constant
 */
export const ZERO_ADDRESS: EthAddress = '0x0000000000000000000000000000000000000000';

/**
 * Check if an address is the zero address
 */
export function isZeroAddress(address: string): boolean {
  return addressesEqual(address, ZERO_ADDRESS);
}
