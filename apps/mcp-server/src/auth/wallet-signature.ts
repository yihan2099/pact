import { verifySignature, createAuthChallenge, parseAuthChallenge } from '@porternetwork/web3-utils';

// Store active challenges (in production, use Redis or similar)
const activeChallenges = new Map<
  string,
  { nonce: string; createdAt: number; expiresAt: number }
>();

// Challenge expiration time (5 minutes)
const CHALLENGE_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Generate a new authentication challenge for a wallet address
 */
export function generateChallenge(address: `0x${string}`): {
  challenge: string;
  nonce: string;
  expiresAt: number;
} {
  // Generate random nonce
  const nonce = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + CHALLENGE_EXPIRATION_MS;

  // Create challenge message
  const challenge = createAuthChallenge(address, nonce);

  // Store challenge
  activeChallenges.set(address.toLowerCase(), {
    nonce,
    createdAt: now,
    expiresAt,
  });

  return { challenge, nonce, expiresAt };
}

/**
 * Verify a signed challenge
 */
export async function verifyChallengeSignature(
  address: `0x${string}`,
  signature: `0x${string}`,
  challenge: string
): Promise<{
  valid: boolean;
  error?: string;
}> {
  const normalizedAddress = address.toLowerCase();

  // Check if challenge exists
  const storedChallenge = activeChallenges.get(normalizedAddress);
  if (!storedChallenge) {
    return { valid: false, error: 'No active challenge found' };
  }

  // Check if challenge expired
  if (Date.now() > storedChallenge.expiresAt) {
    activeChallenges.delete(normalizedAddress);
    return { valid: false, error: 'Challenge expired' };
  }

  // Parse challenge to verify nonce
  const parsed = parseAuthChallenge(challenge);
  if (parsed.nonce !== storedChallenge.nonce) {
    return { valid: false, error: 'Invalid nonce' };
  }

  // Verify signature
  const isValid = await verifySignature(challenge, signature, address);
  if (!isValid) {
    return { valid: false, error: 'Invalid signature' };
  }

  // Clean up used challenge
  activeChallenges.delete(normalizedAddress);

  return { valid: true };
}

/**
 * Cleanup expired challenges
 */
export function cleanupExpiredChallenges(): void {
  const now = Date.now();
  for (const [address, challenge] of activeChallenges) {
    if (now > challenge.expiresAt) {
      activeChallenges.delete(address);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredChallenges, 60 * 1000);
