import { describe, test, expect, mock } from 'bun:test';

// Import withRetry from the module (may be real or inline replica via mock).
// Import withRetryResult directly -- it's mock-wrapped by the test factory but
// we need the real version here, so we construct it ourselves from withRetry.
const { withRetry } = await import('../../utils/retry');

// Build a real withRetryResult on top of the (real) withRetry.
// This avoids depending on the mock factory's simplified withRetryResult.
interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}
interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
}

async function withRetryResult<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<FetchResult<T>> {
  let attempts = 0;
  const wrappedFn = async (): Promise<T> => {
    attempts++;
    return fn();
  };
  try {
    const data = await withRetry(wrappedFn, {
      ...options,
      onRetry: (attempt: number, error: Error, delayMs: number) => {
        options.onRetry?.(attempt, error, delayMs);
      },
    });
    return { success: true, data, attempts };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      attempts,
    };
  }
}

describe('withRetry', () => {
  test('returns result on first attempt success', async () => {
    const fn = mock(() => Promise.resolve('ok'));
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries on failure and succeeds on second attempt', async () => {
    let attempt = 0;
    const fn = mock(() => {
      attempt++;
      if (attempt === 1) return Promise.reject(new Error('fail'));
      return Promise.resolve('recovered');
    });
    const result = await withRetry(fn, { initialDelayMs: 1, maxDelayMs: 5 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('throws after maxAttempts exhausted', async () => {
    const fn = mock(() => Promise.reject(new Error('persistent failure')));
    await expect(
      withRetry(fn, { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 5 })
    ).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('calls onRetry callback between attempts', async () => {
    let attempt = 0;
    const fn = mock(() => {
      attempt++;
      if (attempt < 3) return Promise.reject(new Error(`fail-${attempt}`));
      return Promise.resolve('ok');
    });
    const onRetry = mock(() => {});
    await withRetry(fn, { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 5, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect((onRetry.mock.calls[0] as any[])[0]).toBe(1);
    expect((onRetry.mock.calls[1] as any[])[0]).toBe(2);
  });

  test('uses default options when none provided', async () => {
    const fn = mock(() => Promise.resolve(42));
    const result = await withRetry(fn);
    expect(result).toBe(42);
  });

  test('delay does not exceed maxDelayMs', async () => {
    let attempt = 0;
    const delays: number[] = [];
    const fn = mock(() => {
      attempt++;
      if (attempt < 3) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    });
    const onRetry = mock((a: number, _e: Error, d: number) => {
      delays.push(d);
    });
    await withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 150,
      backoffMultiplier: 10,
      onRetry,
    });
    for (const delay of delays) {
      expect(delay).toBeLessThanOrEqual(150);
    }
  });

  test('wraps non-Error throws into Error objects', async () => {
    const fn = mock(() => Promise.reject('string error'));
    await expect(withRetry(fn, { maxAttempts: 1, initialDelayMs: 1 })).rejects.toThrow(
      'string error'
    );
  });

  test('exponential backoff increases delay between attempts', async () => {
    let attempt = 0;
    const delays: number[] = [];
    const fn = mock(() => {
      attempt++;
      if (attempt < 4) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    });
    const onRetry = mock((_a: number, _e: Error, d: number) => {
      delays.push(d);
    });
    await withRetry(fn, {
      maxAttempts: 4,
      initialDelayMs: 100,
      maxDelayMs: 100000,
      backoffMultiplier: 2,
      onRetry,
    });
    expect(delays.length).toBe(3);
    expect(delays[2]).toBeGreaterThan(delays[0]);
  });
});

describe('withRetryResult', () => {
  test('returns success result on first attempt', async () => {
    const fn = mock(() => Promise.resolve({ id: 1 }));
    const result = await withRetryResult(fn);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1 });
    expect(result.attempts).toBe(1);
  });

  test('returns failure result after all attempts fail', async () => {
    const fn = mock(() => Promise.reject(new Error('boom')));
    const result = await withRetryResult(fn, {
      maxAttempts: 2,
      initialDelayMs: 1,
      maxDelayMs: 5,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result.data).toBeUndefined();
    expect(result.attempts).toBe(2);
  });

  test('tracks total attempts including successful one', async () => {
    let call = 0;
    const fn = mock(() => {
      call++;
      if (call < 3) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    });
    const result = await withRetryResult(fn, {
      maxAttempts: 5,
      initialDelayMs: 1,
      maxDelayMs: 5,
    });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
  });

  test('forwards onRetry to withRetry', async () => {
    let call = 0;
    const fn = mock(() => {
      call++;
      if (call === 1) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    });
    const onRetry = mock(() => {});
    await withRetryResult(fn, {
      maxAttempts: 3,
      initialDelayMs: 1,
      maxDelayMs: 5,
      onRetry,
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('handles non-Error thrown values', async () => {
    const fn = mock(() => Promise.reject(42));
    const result = await withRetryResult(fn, {
      maxAttempts: 1,
      initialDelayMs: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('42');
  });
});
