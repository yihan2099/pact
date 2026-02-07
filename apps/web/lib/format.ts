import { formatUnits } from 'viem';

/**
 * Format a timestamp to a relative time string (e.g., "2 hours ago")
 */
export function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) {
    return 'just now';
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
 * Format a timestamp to a compact relative time (e.g., "2m", "5h", "3d")
 */
export function formatTimeCompact(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) {
    return 'now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo`;
  }

  const years = Math.floor(months / 12);
  return `${years}y`;
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
 * Get the BaseScan URL for a transaction hash on Base Sepolia
 */
export function getBaseScanTxUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}

/**
 * Get the IPFS gateway URL for a CID
 */
export function getIpfsUrl(cid: string): string {
  // Use public IPFS gateway - can be replaced with Pinata gateway if env var is available
  if (cid.startsWith('ipfs://')) {
    cid = cid.replace('ipfs://', '');
  }
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

/**
 * Get status color class for task status badges
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'open':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'in_review':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'completed':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'disputed':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'refunded':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    case 'cancelled':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/**
 * Format status for display
 */
export function formatStatus(status: string): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'in_review':
      return 'In Review';
    case 'completed':
      return 'Completed';
    case 'disputed':
      return 'Disputed';
    case 'refunded':
      return 'Refunded';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

/**
 * Get status color class for dispute status badges
 */
export function getDisputeStatusColor(status: string, disputerWon: boolean | null): string {
  if (status === 'active') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  if (status === 'resolved' && disputerWon === true) return 'bg-green-500/10 text-green-500 border-green-500/20';
  if (status === 'resolved' && disputerWon === false) return 'bg-red-500/10 text-red-500 border-red-500/20';
  return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
}

/**
 * Format dispute status for display
 */
export function formatDisputeStatus(status: string, disputerWon: boolean | null): string {
  if (status === 'active') return 'Active';
  if (status === 'resolved' && disputerWon === true) return 'Disputer Won';
  if (status === 'resolved' && disputerWon === false) return 'Disputer Lost';
  if (status === 'resolved') return 'Resolved';
  return status;
}

/**
 * Format bounty amount from wei to ETH with appropriate decimals
 */
export function formatBounty(weiAmount: string): string {
  try {
    const eth = formatUnits(BigInt(weiAmount), 18);
    const num = parseFloat(eth);
    if (num === 0) return '0 ETH';
    if (num < 0.0001) return '<0.0001 ETH';
    if (num < 1) return `${num.toFixed(4)} ETH`;
    return `${num.toFixed(2)} ETH`;
  } catch {
    return '0 ETH';
  }
}
