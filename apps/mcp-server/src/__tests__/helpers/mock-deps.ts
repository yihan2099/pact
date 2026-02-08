/**
 * Shared mock factories for all @clawboy/* dependencies.
 *
 * Each factory returns a complete module mock object with ALL exports stubbed,
 * preventing mock contamination between test files that run in the same
 * bun test process.
 *
 * Usage:
 *   import { mock } from 'bun:test';
 *   import { createContractsMock, createWeb3UtilsMock, ... } from '../helpers/mock-deps';
 *
 *   mock.module('@clawboy/contracts', createContractsMock);
 *
 * Each factory is a function that returns the mock object, compatible with
 * bun's `mock.module(specifier, factory)` API.
 */
import { mock } from 'bun:test';

// ---------------------------------------------------------------------------
// @clawboy/contracts
// ---------------------------------------------------------------------------
export function createContractsMock() {
  return {
    // ABIs
    TaskManagerABI: [],
    EscrowVaultABI: [],
    DisputeResolverABI: [],
    ClawboyAgentAdapterABI: [],
    ERC8004IdentityRegistryABI: [],
    ERC8004ReputationRegistryABI: [],

    // Addresses
    getContractAddresses: mock(() => ({
      taskManager: '0xTaskManager',
      escrowVault: '0xEscrowVault',
      disputeResolver: '0xDisputeResolver',
      identityRegistry: '0xIdentityRegistry',
      reputationRegistry: '0xReputationRegistry',
      agentAdapter: '0xAgentAdapter',
    })),
    isSupportedChain: mock(() => true),
    BASE_SEPOLIA_ADDRESSES: {},
    BASE_SEPOLIA_CHAIN_ID: 84532,
    BASE_MAINNET_ADDRESSES: {},
    BASE_MAINNET_CHAIN_ID: 8453,
    LOCAL_ADDRESSES: {},
    LOCAL_CHAIN_ID: 31337,

    // Tokens
    resolveToken: mock(() => ({
      symbol: 'USDC',
      address: '0xUSDC' as `0x${string}`,
      decimals: 6,
    })),
    getSupportedTokens: mock(() => [
      { symbol: 'ETH', address: '0xETH', decimals: 18 },
      { symbol: 'USDC', address: '0xUSDC', decimals: 6 },
    ]),
    getTokenBySymbol: mock(() => ({ symbol: 'USDC', address: '0xUSDC', decimals: 6 })),
    getTokenByAddress: mock(() => ({ symbol: 'ETH', address: '0xETH', decimals: 18 })),
    isNativeToken: mock(() => false),
    isTokenSupported: mock(() => true),
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    SUPPORTED_TOKENS: {},
  };
}

// ---------------------------------------------------------------------------
// @clawboy/web3-utils
// ---------------------------------------------------------------------------
export function createWeb3UtilsMock() {
  return {
    // Client
    getPublicClient: mock(() => ({ readContract: mock(() => Promise.resolve(0n)) })),
    getChain: mock(() => ({})),
    getDefaultRpcUrl: mock(() => 'http://localhost:8545'),
    resetPublicClient: mock(),
    getBlockNumber: mock(() => Promise.resolve(0n)),
    getBalance: mock(() => Promise.resolve(0n)),
    waitForTransaction: mock(() => Promise.resolve({})),
    createWalletFromPrivateKey: mock(() => ({})),
    getAddressFromPrivateKey: mock(() => '0x0' as `0x${string}`),
    signMessage: mock(() => Promise.resolve('0x0')),
    signTypedData: mock(() => Promise.resolve('0x0')),

    // ERC20 utils
    parseTokenAmount: mock(() => 0n),
    formatTokenAmount: mock(() => '0'),
    formatTokenAmountWithSymbol: mock(() => '0 ETH'),
    hasEnoughAllowance: mock(() => true),
    hasEnoughBalance: mock(() => true),
    getTokenAllowance: mock(() => Promise.resolve(0n)),
    getTokenBalance: mock(() => Promise.resolve(0n)),

    // Address utils
    isValidAddress: mock(() => true),
    normalizeAddress: mock(() => '0x0' as `0x${string}`),
    toChecksumAddress: mock(() => '0x0' as `0x${string}`),
    addressesEqual: mock(() => true),
    shortenAddress: mock(() => '0x0...0'),
    isZeroAddress: mock(() => false),

    // Signature utils
    verifySignature: mock(() => Promise.resolve(true)),
    recoverSigner: mock(() => Promise.resolve('0x0' as `0x${string}`)),
    hashEthMessage: mock(() => '0x0' as `0x${string}`),
    keccak256Hash: mock(() => '0x0' as `0x${string}`),
    createAuthChallenge: mock(() => ''),
    parseAuthChallenge: mock(() => ({ address: '', timestamp: '', nonce: '' })),
    isTimestampFresh: mock(() => true),

    // Wei utils
    weiToEth: mock(() => '0'),
    ethToWei: mock(() => 0n),
    weiToUnits: mock(() => '0'),
    unitsToWei: mock(() => 0n),
    formatWei: mock(() => '0'),
    parseUserInput: mock(() => 0n),

    // Contract interactions
    getTaskManagerAddress: mock(() => '0xTaskManager' as `0x${string}`),
    getTaskCount: mock(() => Promise.resolve(0n)),
    getTask: mock(() => Promise.resolve(null)),
    contractStatusToTaskStatus: mock(() => 'open'),

    getEscrowVaultAddress: mock(() => '0xEscrowVault' as `0x${string}`),
    getEscrowBalance: mock(() => Promise.resolve(0n)),

    getAgentAdapterAddress: mock(() => '0xAgentAdapter' as `0x${string}`),
    isAgentRegistered: mock(() => Promise.resolve(false)),
    getAgentId: mock(() => Promise.resolve(0n)),
    getAgentVoteWeight: mock(() => Promise.resolve(1n)),
    getAgentReputationSummary: mock(() =>
      Promise.resolve({ taskWins: 0n, disputeWins: 0n, disputeLosses: 0n, totalReputation: 0n })
    ),
    getIdentityRegistryAddress: mock(() => Promise.resolve('0xIdentityRegistry' as `0x${string}`)),
    getReputationRegistryAddress: mock(() =>
      Promise.resolve('0xReputationRegistry' as `0x${string}`)
    ),
    getAgentURI: mock(() => Promise.resolve(null)),

    // Reputation
    getFeedbackSummary: mock(() =>
      Promise.resolve({ count: 0n, summaryValue: 0n, summaryValueDecimals: 0 })
    ),
    getFeedbackClients: mock(() => Promise.resolve([])),
    getLastFeedbackIndex: mock(() => Promise.resolve(0n)),
    readFeedback: mock(() => Promise.resolve(null)),
    getFeedbackCount: mock(() => Promise.resolve(0n)),
    getAllFeedback: mock(() => Promise.resolve([])),

    // Retry
    withContractRetry: mock((fn: () => any) => fn()),
  };
}

// ---------------------------------------------------------------------------
// @clawboy/database
// ---------------------------------------------------------------------------
export function createDatabaseMock() {
  return {
    // Client
    getSupabaseClient: mock(() => ({
      from: () => ({
        select: mock().mockReturnThis(),
        eq: mock().mockReturnThis(),
        order: mock().mockReturnThis(),
        range: mock(() => Promise.resolve({ data: [], error: null, count: 0 })),
      }),
    })),
    getSupabaseAdminClient: mock(() => ({})),
    resetSupabaseClient: mock(),

    // Task queries
    listTasks: mock(() => Promise.resolve({ tasks: [], total: 0 })),
    getTaskById: mock(() => Promise.resolve(null)),
    getTaskByChainId: mock(() => Promise.resolve(null)),
    createTask: mock(() => Promise.resolve({})),
    updateTask: mock(() => Promise.resolve({})),
    getTasksInReview: mock(() => Promise.resolve([])),
    getTasksReadyForFinalization: mock(() => Promise.resolve([])),
    getDisputedTasks: mock(() => Promise.resolve([])),
    getTasksWithFailedIpfs: mock(() => Promise.resolve([])),

    // Agent queries
    listAgents: mock(() => Promise.resolve({ agents: [], total: 0 })),
    getAgentByAddress: mock(() => Promise.resolve(null)),
    upsertAgent: mock(() => Promise.resolve({})),
    updateAgent: mock(() => Promise.resolve({})),
    getTopAgents: mock(() => Promise.resolve([])),
    incrementTasksWon: mock(() => Promise.resolve()),
    incrementDisputesWon: mock(() => Promise.resolve()),
    incrementDisputesLost: mock(() => Promise.resolve()),
    updateAgentReputation: mock(() => Promise.resolve()),
    calculateVoteWeight: mock(() => 1),
    getAgentsWithFailedIpfs: mock(() => Promise.resolve([])),

    // Submission queries
    getSubmissionsByTaskId: mock(() => Promise.resolve([])),
    getSubmissionByTaskAndAgent: mock(() => Promise.resolve(null)),
    getWinningSubmission: mock(() => Promise.resolve(null)),
    getSubmissionsByAgent: mock(() => Promise.resolve({ submissions: [], total: 0 })),
    createSubmission: mock(() => Promise.resolve({})),
    updateSubmission: mock(() => Promise.resolve({})),
    markSubmissionAsWinner: mock(() => Promise.resolve({})),

    // Dispute queries
    getDisputeById: mock(() => Promise.resolve(null)),
    getDisputeByChainId: mock(() => Promise.resolve(null)),
    getDisputeByTaskId: mock(() => Promise.resolve(null)),
    listActiveDisputes: mock(() => Promise.resolve([])),
    getDisputesReadyForResolution: mock(() => Promise.resolve([])),
    createDispute: mock(() => Promise.resolve({})),
    updateDispute: mock(() => Promise.resolve({})),
    getDisputeVotes: mock(() => Promise.resolve([])),
    getDisputeVote: mock(() => Promise.resolve(null)),
    hasVoted: mock(() => Promise.resolve(false)),
    createDisputeVote: mock(() => Promise.resolve({})),
    getVotesByVoter: mock(() => Promise.resolve([])),

    // Sync state queries
    getLastSyncedBlock: mock(() => Promise.resolve(null)),
    updateSyncState: mock(() => Promise.resolve()),
    getSyncStatesForChain: mock(() => Promise.resolve([])),

    // Statistics queries
    getPlatformStatistics: mock(() => Promise.resolve({})),
    getRecentOpenTasks: mock(() => Promise.resolve([])),
    getRecentSubmissions: mock(() => Promise.resolve([])),
    getDetailedTasks: mock(() => Promise.resolve([])),
    getDetailedDisputes: mock(() => Promise.resolve([])),
    getTagStatistics: mock(() => Promise.resolve([])),
    getFeaturedCompletedTasks: mock(() => Promise.resolve([])),
    getBountyStatistics: mock(() => Promise.resolve({})),

    // Event processing
    isEventProcessed: mock(() => Promise.resolve(false)),
    markEventProcessed: mock(() => Promise.resolve(true)),
    addFailedEvent: mock(() => Promise.resolve('')),
    getRetryableFailedEvents: mock(() => Promise.resolve([])),
    getFailedEvents: mock(() => Promise.resolve([])),
    resolveFailedEvent: mock(() => Promise.resolve(true)),
    updateFailedEventRetry: mock(() => Promise.resolve()),
    getFailedEventStats: mock(() => Promise.resolve({ total: 0, pending: 0, resolved: 0 })),
    cleanupOldProcessedEvents: mock(() => Promise.resolve(0)),

    // Webhook queries
    getAgentsWithWebhooks: mock(() => Promise.resolve([])),
    getAgentWebhookInfo: mock(() => Promise.resolve(null)),
    getAgentsWebhookInfoByAddresses: mock(() => Promise.resolve([])),
    createWebhookDelivery: mock(() => Promise.resolve({})),
    updateWebhookDelivery: mock(() => Promise.resolve()),
    getRetryableWebhookDeliveries: mock(() => Promise.resolve([])),
  };
}

// ---------------------------------------------------------------------------
// @clawboy/ipfs-utils
// ---------------------------------------------------------------------------
export function createIpfsUtilsMock() {
  return {
    // Upload
    uploadJson: mock(() => Promise.resolve({ cid: 'QmTestCid' })),
    uploadTaskSpecification: mock(() => Promise.resolve({ cid: 'QmSpecCid' })),
    uploadAgentProfile: mock(() => Promise.resolve({ cid: 'QmAgentCid' })),
    uploadWorkSubmission: mock(() => Promise.resolve({ cid: 'QmWorkCid' })),
    uploadDisputeEvidence: mock(() => Promise.resolve({ cid: 'QmDisputeCid' })),
    uploadFile: mock(() => Promise.resolve({ cid: 'QmFileCid' })),
    uploadBlob: mock(() => Promise.resolve({ cid: 'QmBlobCid' })),
    uploadBytes: mock(() => Promise.resolve({ cid: 'QmBytesCid' })),

    // Fetch
    fetchJson: mock(() => Promise.resolve({})),
    fetchTaskSpecification: mock(() => Promise.resolve({})),
    fetchAgentProfile: mock(() => Promise.resolve({})),
    fetchWorkSubmission: mock(() => Promise.resolve({})),
    fetchDisputeEvidence: mock(() => Promise.resolve({})),
    fetchFile: mock(() => Promise.resolve({ data: Buffer.from(''), contentType: '' })),
    fetchFileAsText: mock(() => Promise.resolve('')),
    fetchFileAsDataUrl: mock(() => Promise.resolve('')),
    cidExists: mock(() => Promise.resolve(true)),

    // Client
    getPinataClient: mock(() => ({})),
    resetPinataClient: mock(),
    getGatewayUrl: mock(() => 'https://gateway.pinata.cloud/ipfs/QmTest'),
    getSignedGatewayUrl: mock(() => Promise.resolve('https://gateway.pinata.cloud/ipfs/QmTest')),
    isValidCid: mock(() => true),
    getPublicGroupId: mock(() => undefined),

    // Schemas
    validateTaskSpecification: mock(() => ({ valid: true, data: {} })),
    createTaskSpecification: mock(() => ({})),
    validateWorkSubmission: mock(() => ({ valid: true, data: {} })),
    createWorkSubmission: mock(() => ({})),
  };
}

// ---------------------------------------------------------------------------
// @clawboy/cache
// ---------------------------------------------------------------------------
export function createCacheMock() {
  return {
    getCache: mock(() => ({
      get: mock(() => Promise.resolve(null)),
      set: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve(true)),
      has: mock(() => Promise.resolve(false)),
      deleteByPattern: mock(() => Promise.resolve(0)),
      getStats: mock(() => ({ hits: 0, misses: 0 })),
    })),
    cacheThrough: mock((_key: string, fn: () => any) => fn()),
    clearAllCache: mock(),
    getCacheStats: mock(() => Promise.resolve({ hits: 0, misses: 0, size: 0 })),
    TTL_CONFIG: {},
    getTTL: mock(() => 60),

    // Key builders
    taskListKey: mock(() => 'task-list'),
    taskKey: mock(() => 'task:id'),
    agentByAddressKey: mock(() => 'agent:addr'),
    agentKey: mock(() => 'agent:id'),
    agentListKey: mock(() => 'agent-list'),
    submissionListKey: mock(() => 'sub-list'),
    submissionKey: mock(() => 'sub:id'),
    disputeKey: mock(() => 'dispute:id'),
    disputeListKey: mock(() => 'dispute-list'),
    platformStatsKey: mock(() => 'stats'),
    topAgentsKey: mock(() => 'top-agents'),
    tagIndexKey: mock(() => 'tag:id'),
    taskPattern: mock(() => 'task:*'),
    taskListPattern: mock(() => 'task-list:*'),
    agentPattern: mock(() => 'agent:*'),
    submissionPattern: mock(() => 'sub:*'),
    statsPattern: mock(() => 'stats:*'),
    KEY_PREFIX: {},

    // Invalidation
    invalidateTaskCaches: mock(() => Promise.resolve(0)),
    invalidateAgentCaches: mock(() => Promise.resolve(0)),
    invalidateSubmissionCaches: mock(() => Promise.resolve(0)),
    invalidateDisputeCaches: mock(() => Promise.resolve(0)),
    invalidateStatsCaches: mock(() => Promise.resolve(0)),
    invalidateAllCaches: mock(() => Promise.resolve(0)),

    // Helpers
    batchFetchWithCache: mock(() => Promise.resolve({ items: new Map(), missingIds: [] })),
    preloadBatch: mock(() => Promise.resolve()),
    getCachedOnly: mock(() => Promise.resolve(new Map())),
    deleteBatch: mock(() => Promise.resolve(0)),
    getCachedTaskList: mock(() => Promise.resolve(null)),
    getCachedTask: mock(() => Promise.resolve(null)),
    getCachedTasksBatch: mock(() => Promise.resolve({ items: new Map(), missingIds: [] })),
    preloadTasks: mock(() => Promise.resolve()),
    getCachedAgentByAddress: mock(() => Promise.resolve(null)),
    getCachedAgent: mock(() => Promise.resolve(null)),
    getCachedAgentList: mock(() => Promise.resolve(null)),
    getCachedAgentsBatch: mock(() => Promise.resolve({ items: new Map(), missingIds: [] })),
    preloadAgents: mock(() => Promise.resolve()),
    getCachedPlatformStats: mock(() => Promise.resolve(null)),
    getCachedTopAgents: mock(() => Promise.resolve(null)),
    getCachedPeriodStats: mock(() => Promise.resolve(null)),
    getCachedCreatorStats: mock(() => Promise.resolve(null)),
    getCachedAgentStats: mock(() => Promise.resolve(null)),
  };
}

// ---------------------------------------------------------------------------
// @clawboy/redis
// ---------------------------------------------------------------------------
export function createRedisMock() {
  return {
    getRedisClient: mock(() => null),
    isRedisEnabled: mock(() => false),
    resetRedisClient: mock(),
  };
}

// ---------------------------------------------------------------------------
// @clawboy/rate-limit
// ---------------------------------------------------------------------------
export function createRateLimitMock() {
  return {
    getRedisClient: mock(() => null),
    isRateLimitingEnabled: mock(() => false),
    isRedisEnabled: mock(() => false),
    WEB_RATE_LIMITS: {},
    createWaitlistLimiter: mock(() => null),
    MCP_RATE_LIMITS: {},
    TOOL_OPERATION_MAP: {},
    getOperationType: mock(() => 'read'),
    getMcpLimiter: mock(() => null),
    getGlobalLimiter: mock(() => null),
    createMcpRateLimitMiddleware: mock(() => async (_c: any, next: any) => next()),
  };
}
