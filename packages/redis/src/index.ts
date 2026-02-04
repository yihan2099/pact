/**
 * @clawboy/redis
 *
 * Foundational Redis client package for the Clawboy platform.
 * Provides a singleton Upstash Redis client with graceful fallback.
 *
 * Environment variables:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;
let redisChecked = false;

/**
 * Get the Upstash Redis client singleton.
 *
 * Returns null if environment variables are not configured,
 * allowing services to implement graceful fallback behavior.
 */
export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  // If we've already checked and it was not configured, return null without re-warning
  if (redisChecked) {
    return null;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisChecked = true;
    console.warn(
      'Redis disabled: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not configured'
    );
    return null;
  }

  redisClient = new Redis({
    url,
    token,
  });

  return redisClient;
}

/**
 * Check if Redis is available (environment configured).
 */
export function isRedisEnabled(): boolean {
  return getRedisClient() !== null;
}

/**
 * Reset the Redis client singleton.
 * Primarily used for testing purposes.
 */
export function resetRedisClient(): void {
  redisClient = null;
  redisChecked = false;
}

// Re-export Redis type for consumers that need it
export type { Redis } from '@upstash/redis';
