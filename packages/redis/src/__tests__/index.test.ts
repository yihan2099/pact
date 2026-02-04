import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';

describe('Redis Client', () => {
  const originalEnv = { ...process.env };
  let resetRedisClient: () => void;
  let getRedisClient: () => unknown;
  let isRedisEnabled: () => boolean;

  beforeEach(async () => {
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    // Fresh import to reset singleton state
    const module = await import('../index');
    resetRedisClient = module.resetRedisClient;
    getRedisClient = module.getRedisClient;
    isRedisEnabled = module.isRedisEnabled;

    // Reset singleton before each test
    resetRedisClient();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetRedisClient();
  });

  test('getRedisClient returns null when UPSTASH_REDIS_REST_URL is missing', () => {
    // Suppress console.warn for this test
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;

    delete process.env.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = 'some-token';

    const result = getRedisClient();

    console.warn = originalWarn;

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  test('getRedisClient returns null when UPSTASH_REDIS_REST_TOKEN is missing', () => {
    // Suppress console.warn for this test
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;

    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const result = getRedisClient();

    console.warn = originalWarn;

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  test('getRedisClient logs warning when Redis is disabled', () => {
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;

    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    getRedisClient();

    console.warn = originalWarn;

    expect(warnSpy).toHaveBeenCalledWith(
      'Redis disabled: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not configured'
    );
  });

  test('isRedisEnabled returns false when not configured', () => {
    // Suppress console.warn
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;

    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const result = isRedisEnabled();

    console.warn = originalWarn;

    expect(result).toBe(false);
  });

  test('resetRedisClient clears the singleton and allows new client creation', () => {
    // Suppress console.warn
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy;

    // Get client without env vars - should return null
    const result1 = getRedisClient();
    expect(result1).toBeNull();

    // Reset the singleton
    resetRedisClient();

    // Now set env vars and get client again
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    // After reset, should create a new client with the env vars
    const result2 = getRedisClient();
    expect(result2).not.toBeNull();

    console.warn = originalWarn;
  });

  test('getRedisClient returns same instance on multiple calls (singleton pattern)', () => {
    // Set up valid env vars
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    const first = getRedisClient();
    const second = getRedisClient();

    expect(first).toBe(second);
    expect(first).not.toBeNull();
  });
});
