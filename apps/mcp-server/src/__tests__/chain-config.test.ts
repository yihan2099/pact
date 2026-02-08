import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { getChainId, resetChainIdCache } from '../config/chain';

describe('Chain Configuration', () => {
  const originalEnv = { ...process.env };
  let exitMock: ReturnType<typeof mock>;

  beforeEach(() => {
    // Reset cache between tests
    resetChainIdCache();

    // Restore env to original
    process.env = { ...originalEnv };
    delete process.env.CHAIN_ID;
    delete process.env.NODE_ENV;

    // Mock process.exit to prevent test runner from exiting
    exitMock = mock(() => {
      throw new Error('process.exit called');
    });
    process.exit = exitMock as unknown as typeof process.exit;
  });

  test('default — no CHAIN_ID, non-production returns 84532', () => {
    delete process.env.CHAIN_ID;
    process.env.NODE_ENV = 'development';
    expect(getChainId()).toBe(84532);
  });

  test('valid env — CHAIN_ID=8453 returns 8453', () => {
    process.env.CHAIN_ID = '8453';
    expect(getChainId()).toBe(8453);
  });

  test('invalid env — CHAIN_ID="abc" exits', () => {
    process.env.CHAIN_ID = 'abc';
    expect(() => getChainId()).toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  test('negative env — CHAIN_ID="-1" exits', () => {
    process.env.CHAIN_ID = '-1';
    expect(() => getChainId()).toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  test('zero env — CHAIN_ID="0" exits', () => {
    process.env.CHAIN_ID = '0';
    expect(() => getChainId()).toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  test('production missing — NODE_ENV=production, no CHAIN_ID exits', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CHAIN_ID;
    expect(() => getChainId()).toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  test('production valid — NODE_ENV=production, CHAIN_ID=8453 returns 8453', () => {
    process.env.NODE_ENV = 'production';
    process.env.CHAIN_ID = '8453';
    expect(getChainId()).toBe(8453);
  });

  test('caching — call twice, env changes between, still returns first value', () => {
    process.env.CHAIN_ID = '8453';
    const first = getChainId();
    process.env.CHAIN_ID = '84532';
    const second = getChainId();
    expect(first).toBe(8453);
    expect(second).toBe(8453);
  });

  test('resetChainIdCache — after reset, re-reads from env', () => {
    process.env.CHAIN_ID = '8453';
    expect(getChainId()).toBe(8453);

    resetChainIdCache();
    process.env.CHAIN_ID = '84532';
    expect(getChainId()).toBe(84532);
  });
});
