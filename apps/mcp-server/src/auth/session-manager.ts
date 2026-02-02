/**
 * Session manager with Redis storage and in-memory fallback
 *
 * Uses Upstash Redis for persistent session storage across server restarts.
 * Falls back to in-memory storage if Redis is unavailable.
 */

import { getRedisClient } from '@porternetwork/rate-limit';

/**
 * Represents an authenticated session for an agent
 */
export interface AuthSession {
  /** Wallet address of the authenticated agent */
  walletAddress: `0x${string}`;
  /** Whether the agent is registered on-chain */
  isRegistered: boolean;
  /** Session creation timestamp */
  createdAt: number;
  /** Session expiration timestamp */
  expiresAt: number;
}

// Session expiration: 24 hours
const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000;
const SESSION_EXPIRATION_SECONDS = 24 * 60 * 60;

// Redis key prefixes
const SESSION_PREFIX = 'session:';
const WALLET_PREFIX = 'wallet:';

// In-memory fallback storage
const memorySessionStore = new Map<string, AuthSession>();
const memoryWalletIndex = new Map<string, Set<string>>();

/**
 * Check if Redis is available
 */
function isRedisAvailable(): boolean {
  return getRedisClient() !== null;
}

/**
 * Create a new authenticated session
 */
export async function createSession(
  walletAddress: `0x${string}`,
  isRegistered: boolean
): Promise<{ sessionId: string; session: AuthSession }> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const session: AuthSession = {
    walletAddress,
    isRegistered,
    createdAt: now,
    expiresAt: now + SESSION_EXPIRATION_MS,
  };

  const redis = getRedisClient();

  if (redis) {
    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const walletKey = `${WALLET_PREFIX}${walletAddress.toLowerCase()}:sessions`;

      // Use pipeline for atomic operations
      const pipeline = redis.pipeline();
      pipeline.set(sessionKey, JSON.stringify(session), { ex: SESSION_EXPIRATION_SECONDS });
      pipeline.sadd(walletKey, sessionId);
      pipeline.expire(walletKey, SESSION_EXPIRATION_SECONDS);
      await pipeline.exec();

      return { sessionId, session };
    } catch (error) {
      console.warn('Redis error in createSession, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  memorySessionStore.set(sessionId, session);
  const normalizedAddress = walletAddress.toLowerCase();
  if (!memoryWalletIndex.has(normalizedAddress)) {
    memoryWalletIndex.set(normalizedAddress, new Set());
  }
  memoryWalletIndex.get(normalizedAddress)!.add(sessionId);

  return { sessionId, session };
}

/**
 * Get an active session by ID
 * Returns null if session doesn't exist or is expired
 */
export async function getSession(sessionId: string): Promise<AuthSession | null> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      // Upstash Redis auto-parses JSON, so we get the object directly
      const data = await redis.get<AuthSession>(sessionKey);

      if (!data) {
        return null;
      }

      // Redis TTL handles expiration automatically
      return data;
    } catch (error) {
      console.warn('Redis error in getSession, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  const session = memorySessionStore.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if session is expired (manual check for in-memory)
  if (Date.now() > session.expiresAt) {
    memorySessionStore.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Update a session's registration status
 * Used when an agent registers mid-session
 */
export async function updateSessionRegistration(
  sessionId: string,
  isRegistered: boolean
): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const session = await redis.get<AuthSession>(sessionKey);

      if (!session) {
        return false;
      }

      // Update the session with new registration status
      const updatedSession: AuthSession = {
        ...session,
        isRegistered,
      };

      // Calculate remaining TTL
      const remainingMs = session.expiresAt - Date.now();
      const remainingSeconds = Math.max(1, Math.floor(remainingMs / 1000));

      await redis.set(sessionKey, JSON.stringify(updatedSession), { ex: remainingSeconds });
      return true;
    } catch (error) {
      console.warn('Redis error in updateSessionRegistration, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  const session = memorySessionStore.get(sessionId);
  if (session) {
    session.isRegistered = isRegistered;
    return true;
  }

  return false;
}

/**
 * Invalidate (delete) a session
 */
export async function invalidateSession(sessionId: string): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;

      // Get session to find wallet address for index cleanup
      // Upstash Redis auto-parses JSON, so we get the object directly
      const session = await redis.get<AuthSession>(sessionKey);
      if (session) {
        const walletKey = `${WALLET_PREFIX}${session.walletAddress.toLowerCase()}:sessions`;

        const pipeline = redis.pipeline();
        pipeline.del(sessionKey);
        pipeline.srem(walletKey, sessionId);
        await pipeline.exec();

        return true;
      }

      return false;
    } catch (error) {
      console.warn('Redis error in invalidateSession, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  const session = memorySessionStore.get(sessionId);
  if (session) {
    const normalizedAddress = session.walletAddress.toLowerCase();
    memoryWalletIndex.get(normalizedAddress)?.delete(sessionId);
    memorySessionStore.delete(sessionId);
    return true;
  }

  return false;
}

/**
 * Invalidate all sessions for a wallet address
 */
export async function invalidateSessionsByWallet(walletAddress: `0x${string}`): Promise<number> {
  const normalizedAddress = walletAddress.toLowerCase();
  const redis = getRedisClient();

  if (redis) {
    try {
      const walletKey = `${WALLET_PREFIX}${normalizedAddress}:sessions`;
      const sessionIds = await redis.smembers(walletKey);

      if (sessionIds.length === 0) {
        return 0;
      }

      // Delete all sessions and the wallet index
      const pipeline = redis.pipeline();
      for (const sid of sessionIds) {
        pipeline.del(`${SESSION_PREFIX}${sid}`);
      }
      pipeline.del(walletKey);
      await pipeline.exec();

      return sessionIds.length;
    } catch (error) {
      console.warn('Redis error in invalidateSessionsByWallet, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  const sessionIds = memoryWalletIndex.get(normalizedAddress);
  if (!sessionIds) {
    return 0;
  }

  const count = sessionIds.size;
  for (const sessionId of sessionIds) {
    memorySessionStore.delete(sessionId);
  }
  memoryWalletIndex.delete(normalizedAddress);

  return count;
}

/**
 * Clean up all expired sessions (only needed for in-memory fallback)
 * Redis TTL handles expiration automatically
 */
export function cleanupExpiredSessions(): number {
  // Only needed for in-memory storage
  if (isRedisAvailable()) {
    return 0;
  }

  const now = Date.now();
  let count = 0;

  for (const [sessionId, session] of memorySessionStore) {
    if (now > session.expiresAt) {
      const normalizedAddress = session.walletAddress.toLowerCase();
      memoryWalletIndex.get(normalizedAddress)?.delete(sessionId);
      memorySessionStore.delete(sessionId);
      count++;
    }
  }

  return count;
}

/**
 * Get session statistics (for monitoring)
 */
export async function getSessionStats(): Promise<{
  totalSessions: number;
  storageType: 'redis' | 'memory';
}> {
  const redis = getRedisClient();

  if (redis) {
    try {
      // Use SCAN to count session keys (more efficient than KEYS for large datasets)
      let cursor: string | number = 0;
      let totalSessions = 0;

      do {
        const result: [string, string[]] = await redis.scan(cursor, {
          match: `${SESSION_PREFIX}*`,
          count: 100,
        });
        cursor = result[0];
        totalSessions += result[1].length;
      } while (cursor !== '0');

      return {
        totalSessions,
        storageType: 'redis',
      };
    } catch (error) {
      console.warn('Redis error in getSessionStats, falling back to memory:', error);
    }
  }

  // Fallback to in-memory storage
  return {
    totalSessions: memorySessionStore.size,
    storageType: 'memory',
  };
}

// Run cleanup every 10 minutes (only affects in-memory fallback)
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);
