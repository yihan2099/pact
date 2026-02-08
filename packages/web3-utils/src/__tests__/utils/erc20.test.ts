import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { setupViemMock } from '../helpers/mock-viem';

const viemMock = setupViemMock();

const {
  getTokenAllowance,
  getTokenBalance,
  formatTokenAmount,
  parseTokenAmount,
  formatTokenAmountWithSymbol,
  hasEnoughAllowance,
  hasEnoughBalance,
} = await import('../../utils/erc20');

const mockReadContract = mock(() => Promise.resolve(0n));
const mockClient = {
  readContract: mockReadContract,
} as any;

const TOKEN = '0x1234567890123456789012345678901234567890' as `0x${string}`;
const OWNER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
const SPENDER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`;

describe('erc20 utils', () => {
  beforeEach(() => {
    mockReadContract.mockClear();
    viemMock.reset();
  });

  describe('getTokenAllowance', () => {
    test('calls readContract with allowance function', async () => {
      mockReadContract.mockResolvedValue(1000n);
      const result = await getTokenAllowance(mockClient, TOKEN, OWNER, SPENDER);
      expect(result).toBe(1000n);
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: TOKEN,
          functionName: 'allowance',
          args: [OWNER, SPENDER],
        })
      );
    });

    test('returns zero allowance', async () => {
      mockReadContract.mockResolvedValue(0n);
      const result = await getTokenAllowance(mockClient, TOKEN, OWNER, SPENDER);
      expect(result).toBe(0n);
    });

    test('propagates contract errors', async () => {
      mockReadContract.mockRejectedValue(new Error('Contract error'));
      await expect(getTokenAllowance(mockClient, TOKEN, OWNER, SPENDER)).rejects.toThrow(
        'Contract error'
      );
    });
  });

  describe('getTokenBalance', () => {
    test('calls readContract with balanceOf function', async () => {
      mockReadContract.mockResolvedValue(5000n);
      const result = await getTokenBalance(mockClient, TOKEN, OWNER);
      expect(result).toBe(5000n);
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'balanceOf',
          args: [OWNER],
        })
      );
    });

    test('returns zero balance', async () => {
      mockReadContract.mockResolvedValue(0n);
      const result = await getTokenBalance(mockClient, TOKEN, OWNER);
      expect(result).toBe(0n);
    });
  });

  describe('formatTokenAmount', () => {
    test('formats with default max decimals', () => {
      const result = formatTokenAmount(1000000n, 6);
      expect(result).toBe('1');
    });

    test('formats with decimal places', () => {
      const result = formatTokenAmount(1500000n, 6);
      expect(result).toBe('1.5');
    });

    test('truncates to maxDecimals', () => {
      const result = formatTokenAmount(1123456n, 6, 2);
      expect(result).toBe('1.12');
    });

    test('removes trailing zeros', () => {
      const result = formatTokenAmount(1100000n, 6, 4);
      expect(result).toBe('1.1');
    });

    test('handles whole numbers', () => {
      const result = formatTokenAmount(5000000n, 6);
      expect(result).toBe('5');
    });
  });

  describe('parseTokenAmount', () => {
    test('parses integer amount', () => {
      const result = parseTokenAmount('100', 6);
      expect(result).toBe(100000000n);
    });

    test('parses decimal amount', () => {
      const result = parseTokenAmount('1.5', 6);
      expect(result).toBe(1500000n);
    });

    test('handles commas in amount', () => {
      const result = parseTokenAmount('1,000', 6);
      expect(result).toBe(1000000000n);
    });

    test('handles whitespace', () => {
      const result = parseTokenAmount('  100  ', 6);
      expect(result).toBe(100000000n);
    });
  });

  describe('formatTokenAmountWithSymbol', () => {
    test('appends symbol to formatted amount', () => {
      const result = formatTokenAmountWithSymbol(1000000n, 6, 'USDC');
      expect(result).toBe('1 USDC');
    });

    test('respects maxDecimals parameter', () => {
      const result = formatTokenAmountWithSymbol(1500000n, 6, 'USDC', 2);
      expect(result).toBe('1.5 USDC');
    });
  });

  describe('hasEnoughAllowance', () => {
    test('returns true when allowance is sufficient', async () => {
      mockReadContract.mockResolvedValue(1000n);
      const result = await hasEnoughAllowance(mockClient, TOKEN, OWNER, SPENDER, 500n);
      expect(result).toBe(true);
    });

    test('returns true when allowance equals amount', async () => {
      mockReadContract.mockResolvedValue(500n);
      const result = await hasEnoughAllowance(mockClient, TOKEN, OWNER, SPENDER, 500n);
      expect(result).toBe(true);
    });

    test('returns false when allowance is insufficient', async () => {
      mockReadContract.mockResolvedValue(100n);
      const result = await hasEnoughAllowance(mockClient, TOKEN, OWNER, SPENDER, 500n);
      expect(result).toBe(false);
    });
  });

  describe('hasEnoughBalance', () => {
    test('returns true when balance is sufficient', async () => {
      mockReadContract.mockResolvedValue(1000n);
      const result = await hasEnoughBalance(mockClient, TOKEN, OWNER, 500n);
      expect(result).toBe(true);
    });

    test('returns true when balance equals amount', async () => {
      mockReadContract.mockResolvedValue(500n);
      const result = await hasEnoughBalance(mockClient, TOKEN, OWNER, 500n);
      expect(result).toBe(true);
    });

    test('returns false when balance is insufficient', async () => {
      mockReadContract.mockResolvedValue(100n);
      const result = await hasEnoughBalance(mockClient, TOKEN, OWNER, 500n);
      expect(result).toBe(false);
    });
  });
});
