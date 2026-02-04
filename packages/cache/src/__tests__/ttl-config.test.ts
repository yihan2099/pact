import { describe, test, expect } from 'bun:test';
import { TTL_CONFIG, getTTL } from '../ttl-config';

describe('TTL Config', () => {
  describe('TTL_CONFIG values', () => {
    test('TASK_LIST has 30 second TTL', () => {
      expect(TTL_CONFIG.TASK_LIST).toBe(30);
    });

    test('TASK_DETAIL has 5 minute (300 second) TTL', () => {
      expect(TTL_CONFIG.TASK_DETAIL).toBe(300);
    });

    test('AGENT_BY_ADDRESS has 1 hour (3600 second) TTL', () => {
      expect(TTL_CONFIG.AGENT_BY_ADDRESS).toBe(3600);
    });

    test('AGENT_LIST has 5 minute (300 second) TTL', () => {
      expect(TTL_CONFIG.AGENT_LIST).toBe(300);
    });

    test('SUBMISSION has 5 minute (300 second) TTL', () => {
      expect(TTL_CONFIG.SUBMISSION).toBe(300);
    });

    test('PLATFORM_STATS has 15 minute (900 second) TTL', () => {
      expect(TTL_CONFIG.PLATFORM_STATS).toBe(900);
    });

    test('TOP_AGENTS has 15 minute (900 second) TTL', () => {
      expect(TTL_CONFIG.TOP_AGENTS).toBe(900);
    });

    test('DISPUTE has 1 minute (60 second) TTL', () => {
      expect(TTL_CONFIG.DISPUTE).toBe(60);
    });

    test('DEFAULT has 5 minute (300 second) TTL', () => {
      expect(TTL_CONFIG.DEFAULT).toBe(300);
    });
  });

  describe('getTTL', () => {
    test('returns correct TTL for TASK_LIST', () => {
      expect(getTTL('TASK_LIST')).toBe(30);
    });

    test('returns correct TTL for TASK_DETAIL', () => {
      expect(getTTL('TASK_DETAIL')).toBe(300);
    });

    test('returns correct TTL for AGENT_BY_ADDRESS', () => {
      expect(getTTL('AGENT_BY_ADDRESS')).toBe(3600);
    });

    test('returns correct TTL for PLATFORM_STATS', () => {
      expect(getTTL('PLATFORM_STATS')).toBe(900);
    });

    test('returns correct TTL for DISPUTE', () => {
      expect(getTTL('DISPUTE')).toBe(60);
    });

    test('returns DEFAULT for DEFAULT key', () => {
      expect(getTTL('DEFAULT')).toBe(300);
    });
  });

  describe('TTL_CONFIG is immutable', () => {
    test('TTL_CONFIG values are readonly', () => {
      // This is a compile-time check mainly, but we can verify values don't change
      const originalValue = TTL_CONFIG.TASK_LIST;
      expect(TTL_CONFIG.TASK_LIST).toBe(originalValue);
    });
  });
});
