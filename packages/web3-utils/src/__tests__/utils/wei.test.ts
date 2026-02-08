import { describe, test, expect } from 'bun:test';
import { setupViemMock } from '../helpers/mock-viem';

setupViemMock();

const { weiToEth, ethToWei, weiToUnits, unitsToWei, formatWei, parseUserInput } =
  await import('../../utils/wei');

describe('wei utils', () => {
  describe('weiToEth', () => {
    test('converts 1 ETH in wei to ETH string', () => {
      const result = weiToEth(1000000000000000000n);
      expect(result).toBe('1');
    });

    test('converts fractional ETH', () => {
      const result = weiToEth(500000000000000000n);
      expect(result).toBe('0.5');
    });

    test('converts zero', () => {
      const result = weiToEth(0n);
      expect(result).toBe('0');
    });
  });

  describe('ethToWei', () => {
    test('converts ETH string to wei', () => {
      const result = ethToWei('1');
      expect(result).toBe(1000000000000000000n);
    });

    test('converts fractional ETH to wei', () => {
      const result = ethToWei('0.5');
      expect(result).toBe(500000000000000000n);
    });

    test('converts zero', () => {
      const result = ethToWei('0');
      expect(result).toBe(0n);
    });
  });

  describe('weiToUnits', () => {
    test('converts with default 18 decimals', () => {
      const result = weiToUnits(1000000000000000000n);
      expect(result).toBe('1');
    });

    test('converts with custom decimals (6 for USDC)', () => {
      const result = weiToUnits(1000000n, 6);
      expect(result).toBe('1');
    });
  });

  describe('unitsToWei', () => {
    test('converts with default 18 decimals', () => {
      const result = unitsToWei('1');
      expect(result).toBe(1000000000000000000n);
    });

    test('converts with custom decimals (6 for USDC)', () => {
      const result = unitsToWei('1', 6);
      expect(result).toBe(1000000n);
    });
  });

  describe('formatWei', () => {
    test('formats with default ETH symbol', () => {
      const result = formatWei(1000000000000000000n);
      expect(result).toContain('1');
      expect(result).toContain('ETH');
    });

    test('formats with custom symbol', () => {
      const result = formatWei(1000000n, { decimals: 6, symbol: 'USDC' });
      expect(result).toContain('1');
      expect(result).toContain('USDC');
    });

    test('truncates decimals to maxDecimals', () => {
      const result = formatWei(1123456789000000000n, { maxDecimals: 2 });
      expect(result).toContain('1.12');
    });
  });

  describe('parseUserInput', () => {
    test('parses plain number', () => {
      const result = parseUserInput('1');
      expect(result).toBe(1000000000000000000n);
    });

    test('strips commas', () => {
      const result = parseUserInput('1,000');
      expect(result).toBe(1000000000000000000000n);
    });

    test('strips trailing symbol', () => {
      const result = parseUserInput('1ETH');
      expect(result).toBe(1000000000000000000n);
    });

    test('handles whitespace', () => {
      const result = parseUserInput('  1  ');
      expect(result).toBe(1000000000000000000n);
    });
  });
});
