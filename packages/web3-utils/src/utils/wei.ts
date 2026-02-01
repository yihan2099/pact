import { formatEther, parseEther, formatUnits, parseUnits } from 'viem';

/**
 * Convert wei to ETH string
 */
export function weiToEth(wei: bigint): string {
  return formatEther(wei);
}

/**
 * Convert ETH string to wei
 */
export function ethToWei(eth: string): bigint {
  return parseEther(eth);
}

/**
 * Convert wei to a formatted string with specified decimals
 */
export function weiToUnits(wei: bigint, decimals: number = 18): string {
  return formatUnits(wei, decimals);
}

/**
 * Convert a string amount to wei with specified decimals
 */
export function unitsToWei(amount: string, decimals: number = 18): bigint {
  return parseUnits(amount, decimals);
}

/**
 * Format wei as a human-readable string with ETH suffix
 */
export function formatWei(
  wei: bigint,
  options: {
    decimals?: number;
    maxDecimals?: number;
    symbol?: string;
  } = {}
): string {
  const { decimals = 18, maxDecimals = 4, symbol = 'ETH' } = options;

  const value = formatUnits(wei, decimals);
  const parts = value.split('.');

  if (parts.length === 1) {
    return `${value} ${symbol}`;
  }

  const truncatedDecimals = parts[1].slice(0, maxDecimals);
  const formatted = truncatedDecimals
    ? `${parts[0]}.${truncatedDecimals}`
    : parts[0];

  return `${formatted} ${symbol}`;
}

/**
 * Parse a user input string to wei, handling various formats
 */
export function parseUserInput(input: string, decimals: number = 18): bigint {
  // Remove whitespace and handle common formatting
  const cleaned = input.trim().replace(/,/g, '').replace(/\s+/g, '');

  // Remove any trailing symbol (ETH, etc.)
  const numericPart = cleaned.replace(/[a-zA-Z]+$/, '').trim();

  return parseUnits(numericPart, decimals);
}
