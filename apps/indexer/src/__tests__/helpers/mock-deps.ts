import { mock } from 'bun:test';

// ============ Singleton mock instances ============
// Each factory returns the SAME instance on every call so that all test files
// share the same mock function references. This is critical because Bun's
// mock.module is a global operation -- calling it multiple times for the same
// module path replaces the previous mock. By sharing instances, every test
// file that calls `setupMock()` registers the same functions, and every test
// file's assertions target the same function references that the source code
// actually calls.
//
// resetAll() clears call history AND restores the default implementations.

type MockFn = ReturnType<typeof mock>;

/**
 * Create a mock function and return it along with a reset helper that
 * restores its original implementation.
 */
function createResettableMock<T extends (...args: unknown[]) => unknown>(
  defaultImpl: T
): MockFn & { _reset: () => void } {
  const fn = mock(defaultImpl) as MockFn & { _reset: () => void };
  fn._reset = () => {
    fn.mockClear();
    fn.mockImplementation(defaultImpl);
  };
  return fn;
}

function resetAllMocks(fns: Record<string, unknown>) {
  Object.values(fns).forEach((fn) => {
    if (typeof fn === 'function' && '_reset' in fn) {
      (fn as MockFn & { _reset: () => void })._reset();
    }
  });
}

// ---------- @clawboy/database ----------

let _dbInstance: ReturnType<typeof _createMockDatabase> | null = null;

function _createMockDatabase() {
  // Task operations
  const createTask = createResettableMock(() => Promise.resolve({ id: 'task-1' }));
  const updateTask = createResettableMock(() => Promise.resolve());
  const getTaskByChainId = createResettableMock(() =>
    Promise.resolve({
      id: 'db-task-1',
      status: 'open',
      chain_task_id: '1',
      creator_address: '0xcreator',
    })
  );
  const getTaskById = createResettableMock(() => Promise.resolve({ id: 'task-1' }));
  const getTasksWithFailedIpfs = createResettableMock(() => Promise.resolve([]));

  // Submission operations
  const createSubmission = createResettableMock(() => Promise.resolve({ id: 'sub-1' }));
  const updateSubmission = createResettableMock(() => Promise.resolve());
  const getSubmissionByTaskAndAgent = createResettableMock(() => Promise.resolve(null));
  const markSubmissionAsWinner = createResettableMock(() => Promise.resolve({ id: 'sub-1' }));
  const getSubmissionsByTaskId = createResettableMock(() =>
    Promise.resolve({ submissions: [], total: 0 })
  );

  // Agent operations
  const upsertAgent = createResettableMock(() => Promise.resolve());
  const getAgentByAddress = createResettableMock(() => Promise.resolve(null));
  const updateAgent = createResettableMock(() => Promise.resolve());
  const getAgentsWithFailedIpfs = createResettableMock(() => Promise.resolve([]));
  const incrementTasksWon = createResettableMock(() => Promise.resolve());
  const incrementDisputesWon = createResettableMock(() => Promise.resolve());
  const incrementDisputesLost = createResettableMock(() => Promise.resolve());

  // Dispute operations
  const createDispute = createResettableMock(() => Promise.resolve({ id: 'dispute-1' }));
  const updateDispute = createResettableMock(() => Promise.resolve());
  const getDisputeByChainId = createResettableMock(() =>
    Promise.resolve({ id: 'db-dispute-1', disputer_address: '0xdisputer' })
  );
  const createDisputeVote = createResettableMock(() => Promise.resolve());

  // Sync state
  const getLastSyncedBlock = createResettableMock(() => Promise.resolve(null));
  const updateSyncState = createResettableMock(() => Promise.resolve());

  // Webhook operations
  const getAgentsWithWebhooks = createResettableMock(() => Promise.resolve([]));
  const getAgentsWebhookInfoByAddresses = createResettableMock(() => Promise.resolve([]));
  const getAgentWebhookInfo = createResettableMock(() => Promise.resolve(null));
  const createWebhookDelivery = createResettableMock(() => Promise.resolve({ id: 'delivery-1' }));
  const updateWebhookDelivery = createResettableMock(() => Promise.resolve());
  const getRetryableWebhookDeliveries = createResettableMock(() => Promise.resolve([]));

  const allExports = {
    createTask,
    updateTask,
    getTaskByChainId,
    getTaskById,
    getTasksWithFailedIpfs,
    createSubmission,
    updateSubmission,
    getSubmissionByTaskAndAgent,
    markSubmissionAsWinner,
    getSubmissionsByTaskId,
    upsertAgent,
    getAgentByAddress,
    updateAgent,
    getAgentsWithFailedIpfs,
    incrementTasksWon,
    incrementDisputesWon,
    incrementDisputesLost,
    createDispute,
    updateDispute,
    getDisputeByChainId,
    createDisputeVote,
    getLastSyncedBlock,
    updateSyncState,
    getAgentsWithWebhooks,
    getAgentsWebhookInfoByAddresses,
    getAgentWebhookInfo,
    createWebhookDelivery,
    updateWebhookDelivery,
    getRetryableWebhookDeliveries,
  };

  return {
    ...allExports,
    setupMock() {
      mock.module('@clawboy/database', () => allExports);
    },
    resetAll() {
      resetAllMocks(allExports);
    },
  };
}

export function createMockDatabase() {
  if (!_dbInstance) _dbInstance = _createMockDatabase();
  return _dbInstance;
}

// ---------- @clawboy/ipfs-utils ----------

let _ipfsInstance: ReturnType<typeof _createMockIpfsUtils> | null = null;

function _createMockIpfsUtils() {
  const fetchTaskSpecification = createResettableMock(() =>
    Promise.resolve({ title: 'Test Task', description: 'A test', tags: ['dev'] })
  );
  const fetchJson = createResettableMock(() => Promise.resolve({ name: 'Agent', skills: [] }));
  const fetchAgentProfile = createResettableMock(() =>
    Promise.resolve({ name: 'Agent', skills: [] })
  );
  const isValidCid = createResettableMock(() => true);

  const allExports = {
    fetchTaskSpecification,
    fetchJson,
    fetchAgentProfile,
    isValidCid,
  };

  return {
    ...allExports,
    setupMock() {
      mock.module('@clawboy/ipfs-utils', () => allExports);
    },
    resetAll() {
      resetAllMocks(allExports);
    },
  };
}

export function createMockIpfsUtils() {
  if (!_ipfsInstance) _ipfsInstance = _createMockIpfsUtils();
  return _ipfsInstance;
}

// ---------- @clawboy/cache ----------

let _cacheInstance: ReturnType<typeof _createMockCache> | null = null;

function _createMockCache() {
  const invalidateTaskCaches = createResettableMock(() => Promise.resolve());
  const invalidateSubmissionCaches = createResettableMock(() => Promise.resolve());
  const invalidateAgentCaches = createResettableMock(() => Promise.resolve());
  const invalidateDisputeCaches = createResettableMock(() => Promise.resolve());

  const allExports = {
    invalidateTaskCaches,
    invalidateSubmissionCaches,
    invalidateAgentCaches,
    invalidateDisputeCaches,
  };

  return {
    ...allExports,
    setupMock() {
      mock.module('@clawboy/cache', () => allExports);
    },
    resetAll() {
      resetAllMocks(allExports);
    },
  };
}

export function createMockCache() {
  if (!_cacheInstance) _cacheInstance = _createMockCache();
  return _cacheInstance;
}

// ---------- @clawboy/shared-types ----------

let _typesInstance: ReturnType<typeof _createMockSharedTypes> | null = null;

function _createMockSharedTypes() {
  const assertValidStatusTransition = createResettableMock(() => {});

  const allExports = {
    assertValidStatusTransition,
  };

  return {
    ...allExports,
    setupMock() {
      mock.module('@clawboy/shared-types', () => allExports);
    },
    resetAll() {
      resetAllMocks(allExports);
    },
  };
}

export function createMockSharedTypes() {
  if (!_typesInstance) _typesInstance = _createMockSharedTypes();
  return _typesInstance;
}

// ---------- retry utility ----------

let _retryInstance: ReturnType<typeof _createMockRetry> | null = null;

// ---------- Inline retry implementations ----------
// The real withRetry/withRetryResult are pure utilities (no external deps).
// We include them here so that:
// 1. retry.test.ts can test the real behaviour
// 2. Handler tests override withRetryResult in beforeEach to skip delays

interface _RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

async function _withRetry<T>(fn: () => Promise<T>, options: _RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30000;
  const backoffMultiplier = options.backoffMultiplier ?? 2;

  let lastError!: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts) break;
      const exp = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      const jitter = exp * 0.25 * (Math.random() * 2 - 1);
      const delayMs = Math.min(exp + jitter, maxDelayMs);
      if (options.onRetry) options.onRetry(attempt, lastError, delayMs);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

// _withRetryResult intentionally removed (was unused)

function _createMockRetry() {
  // Default mock skips delays for handler tests (they override in beforeEach).
  // The real implementations are exported for retry.test.ts.
  const withRetryResult = createResettableMock(((fn: () => Promise<unknown>) =>
    fn().then(
      (data: unknown) => ({ success: true, data, attempts: 1 }),
      (error: Error) => ({ success: false, error: error.message, attempts: 1 })
    )) as any);

  return {
    withRetryResult,
    setupMock() {
      // Provide both real withRetry and mockable withRetryResult.
      // retry.test.ts imports both; handler tests only use withRetryResult.
      mock.module('../../utils/retry', () => ({
        withRetry: _withRetry,
        withRetryResult,
      }));
    },
    resetAll() {
      resetAllMocks({ withRetryResult });
    },
  };
}

export function createMockRetry() {
  if (!_retryInstance) _retryInstance = _createMockRetry();
  return _retryInstance;
}

// ---------- @clawboy/web3-utils ----------

let _web3Instance: ReturnType<typeof _createMockWeb3Utils> | null = null;

function _createMockWeb3Utils() {
  const mockGetLogs = createResettableMock(() => Promise.resolve([]));
  const getPublicClient = createResettableMock(() => ({
    getLogs: mockGetLogs,
  }));
  const getBlockNumber = createResettableMock(() => Promise.resolve(100n));

  const allExports = {
    getPublicClient,
    getBlockNumber,
  };

  return {
    ...allExports,
    mockGetLogs,
    setupMock() {
      mock.module('@clawboy/web3-utils', () => allExports);
    },
    resetAll() {
      mockGetLogs._reset();
      resetAllMocks(allExports);
    },
  };
}

export function createMockWeb3Utils() {
  if (!_web3Instance) _web3Instance = _createMockWeb3Utils();
  return _web3Instance;
}

// ---------- @clawboy/contracts ----------

let _contractsInstance: ReturnType<typeof _createMockContracts> | null = null;

function _createMockContracts() {
  const getContractAddresses = createResettableMock(() => ({
    taskManager: '0xTaskManager',
    agentAdapter: '0xAgentAdapter',
    disputeResolver: '0xDisputeResolver',
  }));

  const allExports = { getContractAddresses };

  return {
    ...allExports,
    setupMock() {
      mock.module('@clawboy/contracts', () => allExports);
    },
    resetAll() {
      resetAllMocks(allExports);
    },
  };
}

export function createMockContracts() {
  if (!_contractsInstance) _contractsInstance = _createMockContracts();
  return _contractsInstance;
}
