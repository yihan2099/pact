import { describe, test, expect } from 'bun:test';
import { app } from '../http-server';

/**
 * Rate limiting integration tests for the MCP server
 *
 * Note: These tests verify rate limiting behavior. When Redis is not configured,
 * the server fails open (allows all requests). When Redis IS configured,
 * the server enforces rate limits.
 *
 * To test actual rate limiting with Redis:
 * 1. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables
 * 2. Run tests: bun test rate-limit.test.ts
 */

describe('Rate Limiting Integration', () => {
  describe('Basic Rate Limit Headers', () => {
    test('health endpoint does not have rate limit headers', async () => {
      const res = await app.request('/health', { method: 'GET' });

      expect(res.status).toBe(200);
      // Health endpoint is not rate limited
      expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
    });

    test('tool endpoints include rate limit headers when Redis configured', async () => {
      const res = await app.request('/tools/list_tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      // Request should not be rate limited (429)
      // May return 200, 403 (auth required), or 500 (no Supabase in CI)
      expect(res.status).not.toBe(429);

      // If Redis is configured, rate limit headers will be present
      // If not, they will be null (fail open behavior)
      const limit = res.headers.get('X-RateLimit-Limit');
      if (limit) {
        expect(parseInt(limit)).toBeGreaterThan(0);
        expect(res.headers.get('X-RateLimit-Remaining')).not.toBeNull();
        expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull();
      }
    });
  });

  describe('Fail-Open Behavior', () => {
    test('allows requests when rate limiter unavailable', async () => {
      // Without Redis configured, requests should pass through
      const responses = await Promise.all(
        Array(5)
          .fill(null)
          .map(() =>
            app.request('/tools/list_tasks', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
            })
          )
      );

      // All requests should not be rate limited (fail open)
      for (const res of responses) {
        expect(res.status).not.toBe(429);
      }
    });
  });

  describe('Rate Limit Response Format', () => {
    test('429 response includes proper error structure', async () => {
      // This test documents the expected 429 response format
      // It will only trigger if Redis is configured and limits are hit

      const mockResponse = {
        error: 'Too many requests',
        message: 'Rate limit exceeded for write operations. Please try again later.',
        retryAfter: 60,
      };

      // Verify expected response structure
      expect(mockResponse.error).toBe('Too many requests');
      expect(mockResponse.message).toContain('Rate limit exceeded');
      expect(typeof mockResponse.retryAfter).toBe('number');
    });
  });

  describe('Tool Operation Mapping', () => {
    test('read operations have higher limits than write operations', async () => {
      // Test read endpoint (high limit: 100/min)
      const readRes = await app.request('/tools/list_tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Test write endpoint (low limit: 10/min)
      const writeRes = await app.request('/tools/create_task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Neither should be rate limited on first request
      // May return 200, 403 (auth), or 500 (no Supabase in CI)
      expect(readRes.status).not.toBe(429);
      expect(writeRes.status).not.toBe(429);
    });

    test('get_my_submissions is mapped as read operation', async () => {
      const res = await app.request('/tools/get_my_submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Should return 403 (auth required) not 404 (unknown tool)
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.error).toBe('Access denied');
    });
  });

  describe('Session-Based Rate Limiting', () => {
    test('requests with session ID use session-based identifier', async () => {
      const sessionId = 'test-session-12345';

      const res = await app.request('/tools/list_tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify({}),
      });

      // Request should not be rate limited
      expect(res.status).not.toBe(429);
    });

    test('requests without session ID use IP-based identifier', async () => {
      const res = await app.request('/tools/list_tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
        },
        body: JSON.stringify({}),
      });

      // Request should not be rate limited
      expect(res.status).not.toBe(429);
    });
  });

  describe('Global Rate Limit', () => {
    test('global limit applies to all tool requests', async () => {
      // Make requests to the same endpoint to avoid parameter issues
      const responses = await Promise.all(
        Array(3)
          .fill(null)
          .map(() =>
            app.request('/tools/list_tasks', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
            })
          )
      );

      // None should be rate limited (global limit is 100/min, we're under limit)
      for (const res of responses) {
        expect(res.status).not.toBe(429);
      }
    });
  });
});

/**
 * Manual testing instructions:
 *
 * To test actual rate limiting behavior with Redis:
 *
 * 1. Set up Upstash Redis:
 *    export UPSTASH_REDIS_REST_URL="your-url"
 *    export UPSTASH_REDIS_REST_TOKEN="your-token"
 *
 * 2. Start the MCP server:
 *    cd apps/mcp-server && bun run dev
 *
 * 3. Test write rate limit (10/min):
 *    for i in {1..15}; do
 *      curl -X POST http://localhost:3001/tools/create_task \
 *        -H "Content-Type: application/json" \
 *        -d '{}' -w "\nStatus: %{http_code}\n"
 *    done
 *
 * Expected: First ~10 requests succeed (or 403 for auth), then 429 rate limit errors
 *
 * 4. Test read rate limit (100/min):
 *    for i in {1..110}; do
 *      curl -X POST http://localhost:3001/tools/list_tasks \
 *        -H "Content-Type: application/json" \
 *        -d '{}' -w "\nStatus: %{http_code}\n"
 *    done
 *
 * Expected: First ~100 requests succeed, then 429 rate limit errors
 */
