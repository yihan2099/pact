import { describe, test, expect, beforeEach, mock } from 'bun:test';

const mockGetSession = mock(() =>
  Promise.resolve({
    walletAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
    isRegistered: true,
  })
);

mock.module('../../auth/session-manager', () => ({
  getSession: mockGetSession,
}));

import { extractSessionId, buildContext } from '../../a2a/a2a-auth';

// Create a minimal Hono-like context mock
function createMockContext(headers: Record<string, string> = {}) {
  return {
    req: {
      header: (name: string) => headers[name] || headers[name.toLowerCase()],
    },
    get: mock(),
    set: mock(),
  } as any;
}

describe('A2A Auth', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue({
      walletAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
      isRegistered: true,
    });
  });

  describe('extractSessionId', () => {
    test('should extract Bearer token from Authorization header', () => {
      const c = createMockContext({ Authorization: 'Bearer my-session-id' });

      const sessionId = extractSessionId(c);

      expect(sessionId).toBe('my-session-id');
    });

    test('should fall back to X-Session-Id header', () => {
      const c = createMockContext({ 'X-Session-Id': 'fallback-session' });

      const sessionId = extractSessionId(c);

      expect(sessionId).toBe('fallback-session');
    });

    test('should return null when no auth headers present', () => {
      const c = createMockContext({});

      const sessionId = extractSessionId(c);

      expect(sessionId).toBeNull();
    });

    test('should prefer Authorization over X-Session-Id', () => {
      const c = createMockContext({
        Authorization: 'Bearer bearer-session',
        'X-Session-Id': 'header-session',
      });

      const sessionId = extractSessionId(c);

      expect(sessionId).toBe('bearer-session');
    });

    test('should handle Bearer token with extra whitespace', () => {
      const c = createMockContext({ Authorization: 'Bearer   session-with-spaces  ' });

      const sessionId = extractSessionId(c);

      expect(sessionId).toBe('session-with-spaces');
    });
  });

  describe('buildContext', () => {
    test('should return unauthenticated context when no sessionId', async () => {
      const context = await buildContext(null);

      expect(context.isAuthenticated).toBe(false);
      expect(context.callerAddress).toBe('0x0000000000000000000000000000000000000000');
      expect(context.sessionId).toBeNull();
    });

    test('should return authenticated context for valid session', async () => {
      const context = await buildContext('valid-session');

      expect(context.isAuthenticated).toBe(true);
      expect(context.callerAddress).toBe('0xaabbccddaabbccddaabbccddaabbccddaabbccdd');
      expect(context.isRegistered).toBe(true);
      expect(context.sessionId).toBe('valid-session');
    });

    test('should return unauthenticated for invalid session', async () => {
      mockGetSession.mockResolvedValue(null as any);

      const context = await buildContext('invalid-session');

      expect(context.isAuthenticated).toBe(false);
      expect(context.sessionId).toBeNull();
    });
  });
});
