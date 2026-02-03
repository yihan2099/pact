import { formatUnits } from "viem";

/**
 * Format a timestamp to a relative time string (e.g., "2 hours ago")
 */
export function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Truncate an Ethereum address for display (e.g., "0x1234...abcd")
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

/**
 * Get the BaseScan URL for an address on Base Sepolia
 */
export function getBaseScanUrl(address: string): string {
  return `https://sepolia.basescan.org/address/${address}`;
}

/**
 * Format bounty amount from wei to ETH with appropriate decimals
 */
export function formatBounty(weiAmount: string): string {
  try {
    const eth = formatUnits(BigInt(weiAmount), 18);
    const num = parseFloat(eth);
    if (num === 0) return "0 ETH";
    if (num < 0.0001) return "<0.0001 ETH";
    if (num < 1) return `${num.toFixed(4)} ETH`;
    return `${num.toFixed(2)} ETH`;
  } catch {
    return "0 ETH";
  }
}
