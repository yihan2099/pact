import { describe, test, expect } from 'bun:test';
import { setupViemMock } from '../helpers/mock-viem';

setupViemMock();

const {
  isValidAddress,
  normalizeAddress,
  addressesEqual,
  shortenAddress,
  isZeroAddress,
  ZERO_ADDRESS,
} = await import('../../utils/address');

describe('address utils', () => {
  describe('isValidAddress', () => {
    test('returns true for valid address', () => {
      expect(isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true);
    });

    test('returns false for invalid address', () => {
      expect(isValidAddress('not-an-address')).toBe(false);
    });

    test('returns false for short address', () => {
      expect(isValidAddress('0x1234')).toBe(false);
    });

    test('returns false for address without 0x prefix', () => {
      expect(isValidAddress('1234567890123456789012345678901234567890')).toBe(false);
    });
  });

  describe('normalizeAddress', () => {
    test('returns checksummed address for valid input', () => {
      const result = normalizeAddress('0x1234567890123456789012345678901234567890');
      expect(result).toBeDefined();
    });

    test('throws for invalid address', () => {
      expect(() => normalizeAddress('invalid')).toThrow('Invalid address');
    });
  });

  describe('addressesEqual', () => {
    test('returns true for same addresses different case', () => {
      expect(
        addressesEqual(
          '0x1234567890123456789012345678901234567890',
          '0x1234567890123456789012345678901234567890'
        )
      ).toBe(true);
    });

    test('returns false for different addresses', () => {
      expect(
        addressesEqual(
          '0x1234567890123456789012345678901234567890',
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        )
      ).toBe(false);
    });

    test('returns false for invalid addresses', () => {
      expect(addressesEqual('invalid', '0x1234567890123456789012345678901234567890')).toBe(false);
    });
  });

  describe('shortenAddress', () => {
    test('shortens address with default lengths', () => {
      const result = shortenAddress('0x1234567890123456789012345678901234567890');
      expect(result).toBe('0x1234...7890');
    });

    test('shortens with custom prefix and suffix', () => {
      const result = shortenAddress('0x1234567890123456789012345678901234567890', 10, 6);
      expect(result).toBe('0x12345678...567890');
    });

    test('throws for invalid address', () => {
      expect(() => shortenAddress('invalid')).toThrow('Invalid address');
    });
  });

  describe('isZeroAddress', () => {
    test('returns true for zero address', () => {
      expect(isZeroAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    test('returns false for non-zero address', () => {
      expect(isZeroAddress('0x1234567890123456789012345678901234567890')).toBe(false);
    });

    test('returns false for invalid address', () => {
      expect(isZeroAddress('invalid')).toBe(false);
    });
  });

  describe('ZERO_ADDRESS', () => {
    test('is the zero address', () => {
      expect(ZERO_ADDRESS).toBe('0x0000000000000000000000000000000000000000');
    });
  });
});
