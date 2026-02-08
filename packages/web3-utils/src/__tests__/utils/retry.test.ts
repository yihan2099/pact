import { describe, test, expect, mock } from 'bun:test';
import { setupViemMock } from '../helpers/mock-viem';

// Setup viem mock so the module graph resolves cleanly
setupViemMock();

const { withContractRetry, ContractReadError } = await import('../../utils/retry');

describe('retry utils', () => {
  describe('withContractRetry', () => {
    test('returns result on first success', async () => {
      const fn = mock(() => Promise.resolve('success'));
      const result = await withContractRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('retries on timeout error', async () => {
      const fn = mock()
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce('success');

      const result = await withContractRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
      });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('retries on network error', async () => {
      const fn = mock().mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce('ok');

      const result = await withContractRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1,
      });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('retries on rate limit error', async () => {
      const fn = mock()
        .mockRejectedValueOnce(new Error('429 rate limit exceeded'))
        .mockResolvedValueOnce('ok');

      const result = await withContractRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1,
      });
      expect(result).toBe('ok');
    });

    test('does not retry non-retryable errors', async () => {
      const fn = mock(() => Promise.reject(new Error('Contract reverted')));

      await expect(withContractRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })).rejects.toThrow(
        ContractReadError
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('throws ContractReadError after all retries', async () => {
      const fn = mock(() => Promise.reject(new Error('network timeout')));

      try {
        await withContractRetry(fn, {
          maxAttempts: 2,
          initialDelayMs: 1,
          maxDelayMs: 5,
        });
        expect(true).toBe(false); // should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ContractReadError);
        expect((error as InstanceType<typeof ContractReadError>).attempts).toBe(2);
      }
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('calls onRetry callback', async () => {
      const onRetry = mock();
      const fn = mock()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('ok');

      await withContractRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 1);
    });

    test('applies exponential backoff', async () => {
      const onRetry = mock();
      const fn = mock()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('ok');

      await withContractRetry(fn, {
        maxAttempts: 4,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        maxDelayMs: 1000,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry.mock.calls[0][2]).toBe(100);
      expect(onRetry.mock.calls[1][2]).toBe(200);
    });

    test('caps delay at maxDelayMs', async () => {
      const onRetry = mock();
      const fn = mock()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('ok');

      await withContractRetry(fn, {
        maxAttempts: 4,
        initialDelayMs: 100,
        backoffMultiplier: 100,
        maxDelayMs: 500,
        onRetry,
      });

      expect(onRetry.mock.calls[1][2]).toBe(500);
    });

    test('uses default config when none provided', async () => {
      const fn = mock(() => Promise.resolve(42));
      const result = await withContractRetry(fn);
      expect(result).toBe(42);
    });

    test('handles non-Error throw values', async () => {
      const fn = mock(() => Promise.reject('string error'));

      await expect(withContractRetry(fn, { maxAttempts: 1, initialDelayMs: 1 })).rejects.toThrow(
        ContractReadError
      );
    });
  });

  describe('ContractReadError', () => {
    test('has correct name', () => {
      const err = new ContractReadError('test');
      expect(err.name).toBe('ContractReadError');
    });

    test('stores cause', () => {
      const cause = new Error('original');
      const err = new ContractReadError('wrapped', cause);
      expect(err.cause).toBe(cause);
    });

    test('stores attempts', () => {
      const err = new ContractReadError('test', undefined, 3);
      expect(err.attempts).toBe(3);
    });
  });
});
