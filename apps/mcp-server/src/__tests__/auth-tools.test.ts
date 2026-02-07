import { describe, test, expect } from 'bun:test';
import { getChallengeHandler } from '../tools/auth/get-challenge';
import { getSessionHandler } from '../tools/auth/get-session';
import { createSession } from '../auth/session-manager';

describe('Auth Tools', () => {
  describe('auth_get_challenge', () => {
    test('should generate a challenge for valid wallet address', async () => {
      // Use unique address per test run to avoid challenge rate limit
      const randomHex = Math.random().toString(16).slice(2, 10);
      const walletAddress = `0x${randomHex}${'b'.repeat(32)}`;

      const result = await getChallengeHandler({ walletAddress });

      expect(result.challenge).toBeDefined();
      expect(result.challenge).toContain('Pact Authentication');
      expect(result.challenge).toContain(walletAddress);
      expect(result.nonce).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.message).toContain('Sign this challenge');
    });

    test('should reject invalid wallet address format', async () => {
      await expect(getChallengeHandler({ walletAddress: 'invalid-address' })).rejects.toThrow(
        'Invalid wallet address format'
      );
    });

    test('should reject wallet address with wrong length', async () => {
      await expect(getChallengeHandler({ walletAddress: '0x1234' })).rejects.toThrow(
        'Invalid wallet address format'
      );
    });

    test('should generate unique nonces for same wallet', async () => {
      // Use unique address per test run to avoid challenge rate limit
      const randomHex = Math.random().toString(16).slice(2, 10);
      const walletAddress = `0x${randomHex}${'a'.repeat(32)}`;

      const result1 = await getChallengeHandler({ walletAddress });
      const result2 = await getChallengeHandler({ walletAddress });

      expect(result1.nonce).not.toBe(result2.nonce);
    });
  });

  describe('auth_session', () => {
    test('should return valid session info', async () => {
      const wallet = '0xcccccccccccccccccccccccccccccccccccccccc' as `0x${string}`;
      const { sessionId } = await createSession(wallet, true);

      const result = await getSessionHandler({ sessionId });

      expect(result.valid).toBe(true);
      expect(result.walletAddress).toBe(wallet);
      expect(result.isRegistered).toBe(true);
      expect(result.createdAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    test('should return invalid for non-existent session', async () => {
      const result = await getSessionHandler({ sessionId: 'non-existent-id' });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('not found');
    });

    test('should invalidate session when action is invalidate with proper auth', async () => {
      const wallet = '0xdddddddddddddddddddddddddddddddddddddddd' as `0x${string}`;
      const { sessionId } = await createSession(wallet, false);

      // Session exists
      const beforeResult = await getSessionHandler({ sessionId });
      expect(beforeResult.valid).toBe(true);

      // Create authenticated context for the same wallet
      const context = {
        callerAddress: wallet,
        isAuthenticated: true,
        isRegistered: false,
        sessionId,
      };

      // Invalidate with proper auth
      const invalidateResult = await getSessionHandler(
        {
          sessionId,
          action: 'invalidate',
        },
        context
      );
      expect(invalidateResult.valid).toBe(false);
      expect(invalidateResult.message).toContain('invalidated successfully');

      // Session no longer exists
      const afterResult = await getSessionHandler({ sessionId });
      expect(afterResult.valid).toBe(false);
    });

    test('should reject invalidation without authentication', async () => {
      const wallet = '0xdddddddddddddddddddddddddddddddddddddddd' as `0x${string}`;
      const { sessionId } = await createSession(wallet, false);

      // Try to invalidate without context (no auth)
      const invalidateResult = await getSessionHandler({
        sessionId,
        action: 'invalidate',
      });
      expect(invalidateResult.valid).toBe(false);
      expect(invalidateResult.message).toContain('Authentication required');
    });

    test('should reject invalidation of another user session', async () => {
      const wallet1 = '0xdddddddddddddddddddddddddddddddddddddddd' as `0x${string}`;
      const wallet2 = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as `0x${string}`;
      const { sessionId: session1 } = await createSession(wallet1, false);
      const { sessionId: session2 } = await createSession(wallet2, false);

      // Try to invalidate wallet1's session using wallet2's auth
      const context = {
        callerAddress: wallet2,
        isAuthenticated: true,
        isRegistered: false,
        sessionId: session2,
      };

      const invalidateResult = await getSessionHandler(
        {
          sessionId: session1,
          action: 'invalidate',
        },
        context
      );
      expect(invalidateResult.valid).toBe(false);
      expect(invalidateResult.message).toContain('only invalidate your own sessions');

      // Session1 should still exist
      const checkResult = await getSessionHandler({ sessionId: session1 });
      expect(checkResult.valid).toBe(true);
    });

    test('should throw if sessionId is missing', async () => {
      await expect(getSessionHandler({})).rejects.toThrow('sessionId is required');
    });
  });
});
