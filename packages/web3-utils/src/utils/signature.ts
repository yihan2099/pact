import { recoverMessageAddress, hashMessage, keccak256, toBytes } from 'viem';

/**
 * Verify a message was signed by the expected address
 */
export async function verifySignature(
  message: string,
  signature: `0x${string}`,
  expectedAddress: `0x${string}`
): Promise<boolean> {
  try {
    const recoveredAddress = await recoverMessageAddress({
      message,
      signature,
    });
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Recover the signer address from a message and signature
 */
export async function recoverSigner(
  message: string,
  signature: `0x${string}`
): Promise<`0x${string}`> {
  return recoverMessageAddress({
    message,
    signature,
  });
}

/**
 * Hash a message using Ethereum's message prefix
 */
export function hashEthMessage(message: string): `0x${string}` {
  return hashMessage(message);
}

/**
 * Keccak256 hash of data
 */
export function keccak256Hash(data: string | Uint8Array): `0x${string}` {
  const bytes = typeof data === 'string' ? toBytes(data) : data;
  return keccak256(bytes);
}

/**
 * Create a challenge message for wallet authentication
 */
export function createAuthChallenge(
  address: `0x${string}`,
  nonce: string,
  domain: string = 'Porter Network'
): string {
  const timestamp = new Date().toISOString();
  return [
    `${domain} Authentication`,
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
    '',
    'Sign this message to authenticate with Porter Network.',
  ].join('\n');
}

/**
 * Parse an auth challenge to extract components
 */
export function parseAuthChallenge(message: string): {
  address?: string;
  nonce?: string;
  timestamp?: string;
} {
  const lines = message.split('\n');
  const result: { address?: string; nonce?: string; timestamp?: string } = {};

  for (const line of lines) {
    // SECURITY: Split only on first ': ' to prevent injection via value
    const colonIndex = line.indexOf(': ');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 2);

    if (key === 'Address') {
      result.address = value;
    } else if (key === 'Nonce') {
      result.nonce = value;
    } else if (key === 'Timestamp') {
      result.timestamp = value;
    }
  }

  return result;
}

/**
 * SECURITY: Validate challenge timestamp is within acceptable window
 * @param timestamp - ISO 8601 timestamp string
 * @param maxAgeMs - Maximum age in milliseconds (default 5 minutes)
 * @returns true if timestamp is valid and fresh
 */
export function isTimestampFresh(timestamp: string, maxAgeMs: number = 5 * 60 * 1000): boolean {
  try {
    const challengeTime = new Date(timestamp).getTime();
    const now = Date.now();

    // Reject future timestamps (with 30 second tolerance for clock skew)
    if (challengeTime > now + 30000) {
      return false;
    }

    // Reject old timestamps
    if (now - challengeTime > maxAgeMs) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
