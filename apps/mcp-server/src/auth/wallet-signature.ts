import { verifySignature, createAuthChallenge, parseAuthChallenge, isTimestampFresh } from '@porternetwork/web3-utils';
import { getRedisClient } from '@porternetwork/rate-limit';

// Challenge expiration time (5 minutes)
const CHALLENGE_EXPIRATION_MS = 5 * 60 * 1000;
const CHALLENGE_EXPIRATION_SECONDS = 5 * 60;

// Maximum active challenges per address (prevents DoS)
const MAX_CHALLENGES_PER_ADDRESS = 3;

// Redis key prefixes
const CHALLENGE_PREFIX = 'challenge:';
const WALLET_CHALLENGES_PREFIX = 'wallet:';
const WALLET_CHALLENGES_SUFFIX = ':challenges';

// In-memory fallback storage (used when Redis unavailable)
const memoryChallenges = new Map<
  string, // nonce as key
  { address: string; createdAt: number; expiresAt: number }
>();
const memoryWalletChallenges = new Map<string, Set<string>>(); // address -> set of nonces

/**
 * Check if Redis is available
 */
function isRedisAvailable(): boolean {
  return getRedisClient() !== null;
}

/**
 * Get active challenge count for an address (for DoS protection)
 */
async function getActiveChallengeCountForAddress(normalizedAddress: string): Promise<number> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const walletKey = `${WALLET_CHALLENGES_PREFIX}${normalizedAddress}${WALLET_CHALLENGES_SUFFIX}`;
      const count = await redis.scard(walletKey);
      return count;
    } catch (error) {
      console.warn('Redis error in getActiveChallengeCountForAddress, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  const nonces = memoryWalletChallenges.get(normalizedAddress);
  if (!nonces) return 0;

  // Count only non-expired challenges
  let count = 0;
  const now = Date.now();
  for (const nonce of nonces) {
    const challenge = memoryChallenges.get(nonce);
    if (challenge && now <= challenge.expiresAt) {
      count++;
    }
  }
  return count;
}

/**
 * Store a challenge
 */
async function storeChallenge(
  nonce: string,
  normalizedAddress: string,
  createdAt: number,
  expiresAt: number
): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const challengeKey = `${CHALLENGE_PREFIX}${nonce}`;
      const walletKey = `${WALLET_CHALLENGES_PREFIX}${normalizedAddress}${WALLET_CHALLENGES_SUFFIX}`;

      const challengeData = JSON.stringify({
        address: normalizedAddress,
        createdAt,
        expiresAt,
      });

      // Use pipeline for atomic operations
      const pipeline = redis.pipeline();
      pipeline.set(challengeKey, challengeData, { ex: CHALLENGE_EXPIRATION_SECONDS });
      pipeline.sadd(walletKey, nonce);
      pipeline.expire(walletKey, CHALLENGE_EXPIRATION_SECONDS);
      await pipeline.exec();

      return;
    } catch (error) {
      console.warn('Redis error in storeChallenge, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  memoryChallenges.set(nonce, {
    address: normalizedAddress,
    createdAt,
    expiresAt,
  });

  if (!memoryWalletChallenges.has(normalizedAddress)) {
    memoryWalletChallenges.set(normalizedAddress, new Set());
  }
  memoryWalletChallenges.get(normalizedAddress)!.add(nonce);
}

/**
 * Get a stored challenge by nonce
 */
async function getStoredChallenge(
  nonce: string
): Promise<{ address: string; createdAt: number; expiresAt: number } | null> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const challengeKey = `${CHALLENGE_PREFIX}${nonce}`;
      const data = await redis.get<string>(challengeKey);

      if (!data) {
        return null;
      }

      // Handle both string and object responses from Redis
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      return data as { address: string; createdAt: number; expiresAt: number };
    } catch (error) {
      console.warn('Redis error in getStoredChallenge, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  return memoryChallenges.get(nonce) || null;
}

/**
 * Delete a challenge by nonce
 */
async function deleteChallenge(nonce: string, normalizedAddress: string): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const challengeKey = `${CHALLENGE_PREFIX}${nonce}`;
      const walletKey = `${WALLET_CHALLENGES_PREFIX}${normalizedAddress}${WALLET_CHALLENGES_SUFFIX}`;

      const pipeline = redis.pipeline();
      pipeline.del(challengeKey);
      pipeline.srem(walletKey, nonce);
      await pipeline.exec();

      return;
    } catch (error) {
      console.warn('Redis error in deleteChallenge, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  memoryChallenges.delete(nonce);
  memoryWalletChallenges.get(normalizedAddress)?.delete(nonce);
}

/**
 * Generate a new authentication challenge for a wallet address
 * SECURITY: Each challenge is unique by nonce, preventing overwrite attacks
 */
export async function generateChallenge(address: `0x${string}`): Promise<{
  challenge: string;
  nonce: string;
  expiresAt: number;
}> {
  const normalizedAddress = address.toLowerCase();

  // SECURITY: Limit active challenges per address to prevent DoS
  const activeCount = await getActiveChallengeCountForAddress(normalizedAddress);
  if (activeCount >= MAX_CHALLENGES_PER_ADDRESS) {
    throw new Error('Too many active challenges. Please complete or wait for existing challenges to expire.');
  }

  // Generate random nonce
  const nonce = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + CHALLENGE_EXPIRATION_MS;

  // Create challenge message
  const challenge = createAuthChallenge(address, nonce);

  // SECURITY: Store challenge by nonce, not address, to prevent overwrites
  await storeChallenge(nonce, normalizedAddress, now, expiresAt);

  return { challenge, nonce, expiresAt };
}

/**
 * Verify a signed challenge
 * SECURITY: Now looks up by nonce to prevent challenge overwrite attacks
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

  // Parse challenge to get nonce for lookup
  const parsed = parseAuthChallenge(challenge);
  if (!parsed.nonce) {
    return { valid: false, error: 'Invalid challenge format: missing nonce' };
  }

  // SECURITY: Verify challenge address matches claimed address
  if (parsed.address?.toLowerCase() !== normalizedAddress) {
    return { valid: false, error: 'Challenge address does not match claimed address' };
  }

  // SECURITY: Verify timestamp in challenge is fresh
  if (!parsed.timestamp || !isTimestampFresh(parsed.timestamp, CHALLENGE_EXPIRATION_MS)) {
    return { valid: false, error: 'Challenge timestamp is invalid or expired' };
  }

  // SECURITY: Look up by nonce, not address
  const storedChallenge = await getStoredChallenge(parsed.nonce);
  if (!storedChallenge) {
    return { valid: false, error: 'No active challenge found for this nonce' };
  }

  // SECURITY: Verify stored address matches claimed address
  if (storedChallenge.address !== normalizedAddress) {
    return { valid: false, error: 'Address mismatch' };
  }

  // Check if challenge expired
  if (Date.now() > storedChallenge.expiresAt) {
    await deleteChallenge(parsed.nonce, normalizedAddress);
    return { valid: false, error: 'Challenge expired' };
  }

  // Verify signature
  const isValid = await verifySignature(challenge, signature, address);
  if (!isValid) {
    return { valid: false, error: 'Invalid signature' };
  }

  // Clean up used challenge (by nonce)
  await deleteChallenge(parsed.nonce, normalizedAddress);

  return { valid: true };
}

/**
 * Cleanup expired challenges (only needed for in-memory fallback)
 * Redis TTL handles expiration automatically
 */
export function cleanupExpiredChallenges(): number {
  // Only needed for in-memory storage
  if (isRedisAvailable()) {
    return 0;
  }

  const now = Date.now();
  let count = 0;

  for (const [nonce, challenge] of memoryChallenges) {
    if (now > challenge.expiresAt) {
      memoryChallenges.delete(nonce);
      memoryWalletChallenges.get(challenge.address)?.delete(nonce);
      count++;
    }
  }

  return count;
}

/**
 * Get active challenge count (for monitoring)
 */
export async function getActiveChallengeCount(): Promise<{
  totalChallenges: number;
  storageType: 'redis' | 'memory';
}> {
  const redis = getRedisClient();

  if (redis) {
    try {
      // Use SCAN to count challenge keys
      let cursor: string | number = 0;
      let totalChallenges = 0;

      do {
        const result: [string, string[]] = await redis.scan(cursor, {
          match: `${CHALLENGE_PREFIX}*`,
          count: 100,
        });
        cursor = result[0];
        totalChallenges += result[1].length;
      } while (cursor !== '0');

      return {
        totalChallenges,
        storageType: 'redis',
      };
    } catch (error) {
      console.warn('Redis error in getActiveChallengeCount, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  return {
    totalChallenges: memoryChallenges.size,
    storageType: 'memory',
  };
}

// Run cleanup every minute (only affects in-memory fallback)
setInterval(cleanupExpiredChallenges, 60 * 1000);
