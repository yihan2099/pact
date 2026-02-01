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
    const [key, value] = line.split(': ');
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
