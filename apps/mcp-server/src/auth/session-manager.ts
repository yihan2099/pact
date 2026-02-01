import type { AgentTier } from '@porternetwork/shared-types';

/**
 * Represents an authenticated session for an agent
 */
export interface AuthSession {
  /** Wallet address of the authenticated agent */
  walletAddress: `0x${string}`;
  /** Agent's tier level */
  tier: AgentTier | null;
  /** Whether the agent can verify other agents' work */
  isVerifier: boolean;
  /** Whether the agent is registered on-chain */
  isRegistered: boolean;
  /** Session creation timestamp */
  createdAt: number;
  /** Session expiration timestamp */
  expiresAt: number;
}

// Session expiration: 24 hours
const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// In-memory session storage (in production, use Redis or similar)
const activeSessions = new Map<string, AuthSession>();

/**
 * Create a new authenticated session
 */
export function createSession(
  walletAddress: `0x${string}`,
  tier: AgentTier | null,
  isVerifier: boolean,
  isRegistered: boolean
): { sessionId: string; session: AuthSession } {
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const session: AuthSession = {
    walletAddress,
    tier,
    isVerifier,
    isRegistered,
    createdAt: now,
    expiresAt: now + SESSION_EXPIRATION_MS,
  };

  activeSessions.set(sessionId, session);

  return { sessionId, session };
}

/**
 * Get an active session by ID
 * Returns null if session doesn't exist or is expired
 */
export function getSession(sessionId: string): AuthSession | null {
  const session = activeSessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Invalidate (delete) a session
 */
export function invalidateSession(sessionId: string): boolean {
  return activeSessions.delete(sessionId);
}

/**
 * Invalidate all sessions for a wallet address
 */
export function invalidateSessionsByWallet(walletAddress: `0x${string}`): number {
  const normalizedAddress = walletAddress.toLowerCase();
  let count = 0;

  for (const [sessionId, session] of activeSessions) {
    if (session.walletAddress.toLowerCase() === normalizedAddress) {
      activeSessions.delete(sessionId);
      count++;
    }
  }

  return count;
}

/**
 * Clean up all expired sessions
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let count = 0;

  for (const [sessionId, session] of activeSessions) {
    if (now > session.expiresAt) {
      activeSessions.delete(sessionId);
      count++;
    }
  }

  return count;
}

/**
 * Get session statistics (for monitoring)
 */
export function getSessionStats(): {
  totalSessions: number;
  expiredSessions: number;
} {
  const now = Date.now();
  let expiredCount = 0;

  for (const session of activeSessions.values()) {
    if (now > session.expiresAt) {
      expiredCount++;
    }
  }

  return {
    totalSessions: activeSessions.size,
    expiredSessions: expiredCount,
  };
}

// Run cleanup every 10 minutes
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);
