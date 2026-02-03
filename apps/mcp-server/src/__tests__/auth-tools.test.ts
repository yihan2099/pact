import { describe, test, expect } from 'bun:test';
import { getChallengeHandler } from '../tools/auth/get-challenge';
import { getSessionHandler } from '../tools/auth/get-session';
import { createSession } from '../auth/session-manager';

describe('Auth Tools', () => {
  describe('auth_get_challenge', () => {
    test('should generate a challenge for valid wallet address', async () => {
      const result = await getChallengeHandler({
        walletAddress: '0x1234567890123456789012345678901234567890',
      });

      expect(result.challenge).toBeDefined();
      expect(result.challenge).toContain('Clawboy Authentication');
      expect(result.challenge).toContain('0x1234567890123456789012345678901234567890');
      expect(result.nonce).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.message).toContain('Sign this challenge');
    });

    test('should reject invalid wallet address format', async () => {
      await expect(
        getChallengeHandler({ walletAddress: 'invalid-address' })
      ).rejects.toThrow('Invalid wallet address format');
    });

    test('should reject wallet address with wrong length', async () => {
      await expect(
        getChallengeHandler({ walletAddress: '0x1234' })
      ).rejects.toThrow('Invalid wallet address length');
    });

    test('should generate unique nonces for same wallet', async () => {
      const result1 = await getChallengeHandler({
        walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });
      const result2 = await getChallengeHandler({
        walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });

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

    test('should invalidate session when action is invalidate', async () => {
      const wallet = '0xdddddddddddddddddddddddddddddddddddddddd' as `0x${string}`;
      const { sessionId } = await createSession(wallet, false);

      // Session exists
      const beforeResult = await getSessionHandler({ sessionId });
      expect(beforeResult.valid).toBe(true);

      // Invalidate
      const invalidateResult = await getSessionHandler({
        sessionId,
        action: 'invalidate',
      });
      expect(invalidateResult.valid).toBe(false);
      expect(invalidateResult.message).toContain('invalidated successfully');

      // Session no longer exists
      const afterResult = await getSessionHandler({ sessionId });
      expect(afterResult.valid).toBe(false);
    });

    test('should throw if sessionId is missing', async () => {
      await expect(getSessionHandler({})).rejects.toThrow('sessionId is required');
    });
  });
});
