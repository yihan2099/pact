import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createSession,
  getSession,
  invalidateSession,
  invalidateSessionsByWallet,
  cleanupExpiredSessions,
  getSessionStats,
} from '../auth/session-manager';
import { AgentTier } from '@porternetwork/shared-types';

describe('Session Manager', () => {
  const testWallet = '0x1234567890123456789012345678901234567890' as `0x${string}`;

  describe('createSession', () => {
    test('should create a session with correct properties', () => {
      const { sessionId, session } = createSession(
        testWallet,
        AgentTier.Established,
        false,
        true
      );

      expect(sessionId).toBeDefined();
      expect(sessionId.length).toBeGreaterThan(0);
      expect(session.walletAddress).toBe(testWallet);
      expect(session.tier).toBe(AgentTier.Established);
      expect(session.isVerifier).toBe(false);
      expect(session.isRegistered).toBe(true);
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });

    test('should create unique session IDs', () => {
      const { sessionId: id1 } = createSession(testWallet, null, false, false);
      const { sessionId: id2 } = createSession(testWallet, null, false, false);

      expect(id1).not.toBe(id2);
    });
  });

  describe('getSession', () => {
    test('should retrieve a valid session', () => {
      const { sessionId, session: createdSession } = createSession(
        testWallet,
        AgentTier.Elite,
        true,
        true
      );

      const retrievedSession = getSession(sessionId);

      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession?.walletAddress).toBe(createdSession.walletAddress);
      expect(retrievedSession?.tier).toBe(createdSession.tier);
      expect(retrievedSession?.isVerifier).toBe(createdSession.isVerifier);
    });

    test('should return null for non-existent session', () => {
      const session = getSession('non-existent-session-id');
      expect(session).toBeNull();
    });
  });

  describe('invalidateSession', () => {
    test('should invalidate an existing session', () => {
      const { sessionId } = createSession(testWallet, null, false, false);

      // Session exists
      expect(getSession(sessionId)).not.toBeNull();

      // Invalidate
      const result = invalidateSession(sessionId);
      expect(result).toBe(true);

      // Session no longer exists
      expect(getSession(sessionId)).toBeNull();
    });

    test('should return false for non-existent session', () => {
      const result = invalidateSession('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('invalidateSessionsByWallet', () => {
    test('should invalidate all sessions for a wallet', () => {
      const wallet1 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
      const wallet2 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`;

      // Create multiple sessions for wallet1
      const { sessionId: s1 } = createSession(wallet1, null, false, false);
      const { sessionId: s2 } = createSession(wallet1, null, false, false);
      const { sessionId: s3 } = createSession(wallet2, null, false, false);

      // All sessions exist
      expect(getSession(s1)).not.toBeNull();
      expect(getSession(s2)).not.toBeNull();
      expect(getSession(s3)).not.toBeNull();

      // Invalidate wallet1 sessions
      const count = invalidateSessionsByWallet(wallet1);
      expect(count).toBe(2);

      // wallet1 sessions gone, wallet2 still exists
      expect(getSession(s1)).toBeNull();
      expect(getSession(s2)).toBeNull();
      expect(getSession(s3)).not.toBeNull();
    });
  });

  describe('getSessionStats', () => {
    test('should return session statistics', () => {
      // Create a session
      createSession(testWallet, null, false, false);

      const stats = getSessionStats();
      expect(stats.totalSessions).toBeGreaterThanOrEqual(1);
      expect(stats.expiredSessions).toBeGreaterThanOrEqual(0);
    });
  });
});
