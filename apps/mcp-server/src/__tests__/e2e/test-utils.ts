/**
 * E2E Test Utilities for Task Lifecycle Tests
 *
 * Provides helper functions for:
 * - Wallet management (create, fund check)
 * - Authentication flow
 * - Contract interactions via viem
 * - Database queries
 *
 * Updated for competitive task system (no claims, direct submissions)
 *
 * Supports both Base Sepolia (chainId 84532) and local Anvil (chainId 31337)
 * Set CHAIN_ID environment variable to switch between them.
 */

import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  createWalletClient,
  http,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
  parseEther,
  formatEther,
  defineChain,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  getPublicClient,
  resetPublicClient,
  getBalance,
  waitForTransaction,
} from '@clawboy/web3-utils';
import { gasTracker } from './gas-tracker';
import {
  TaskManagerABI,
  ClawboyAgentAdapterABI,
  ERC8004IdentityRegistryABI,
  getContractAddresses,
} from '@clawboy/contracts';
import { getTaskByChainId } from '@clawboy/database';

// Chain configuration - supports both Base Sepolia and local Anvil
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532', 10);
const addresses = getContractAddresses(CHAIN_ID);

// Define local Anvil chain
const localAnvil = defineChain({
  id: 31337,
  name: 'Local Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://localhost:8545'] },
  },
});

// Get the appropriate chain and RPC URL based on CHAIN_ID
function getChainConfig(): { chain: Chain; rpcUrl: string } {
  if (CHAIN_ID === 31337) {
    return {
      chain: localAnvil,
      rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    };
  }
  return {
    chain: baseSepolia,
    rpcUrl: process.env.RPC_URL || 'https://sepolia.base.org',
  };
}

// Zero address for native ETH
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// Minimum required balance for tests
const MIN_CREATOR_BALANCE = parseEther('0.01'); // For bounty + gas
const MIN_AGENT_BALANCE = parseEther('0.005'); // For gas only

/**
 * Test wallet configuration
 */
export interface TestWallet {
  privateKey: `0x${string}`;
  address: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
  walletClient: WalletClient<Transport, Chain, Account>;
}

/**
 * Create a test wallet from a private key
 */
export function createTestWallet(privateKey: `0x${string}`): TestWallet {
  const account = privateKeyToAccount(privateKey);
  const { chain, rpcUrl } = getChainConfig();
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  return {
    privateKey,
    address: account.address,
    account,
    walletClient,
  };
}

/**
 * Generate a new random test wallet
 */
export function generateTestWallet(): TestWallet {
  const privateKey = generatePrivateKey();
  return createTestWallet(privateKey);
}

/**
 * Check if a wallet has sufficient balance for its role
 */
export async function checkWalletBalance(
  address: `0x${string}`,
  role: 'creator' | 'agent'
): Promise<{ sufficient: boolean; balance: bigint; required: bigint }> {
  const balance = await getBalance(address, CHAIN_ID);
  const required = role === 'creator' ? MIN_CREATOR_BALANCE : MIN_AGENT_BALANCE;

  return {
    sufficient: balance >= required,
    balance,
    required,
  };
}

/**
 * Format balance check result for display
 */
export function formatBalanceCheck(result: {
  sufficient: boolean;
  balance: bigint;
  required: bigint;
}): string {
  return `Balance: ${formatEther(result.balance)} ETH, Required: ${formatEther(result.required)} ETH, Sufficient: ${result.sufficient}`;
}

// ============================================================================
// Authentication Helpers
// ============================================================================

import { getChallengeHandler } from '../../tools/auth/get-challenge';
import { verifySignatureHandler } from '../../tools/auth/verify-signature';

/**
 * Complete the authentication flow for a wallet
 */
export async function authenticateWallet(wallet: TestWallet): Promise<{
  sessionId: string;
  walletAddress: `0x${string}`;
  isRegistered: boolean;
}> {
  // Step 1: Get challenge
  const challengeResult = await getChallengeHandler({
    walletAddress: wallet.address,
  });

  // Step 2: Sign the challenge
  const signature = await wallet.account.signMessage({
    message: challengeResult.challenge,
  });

  // Step 3: Verify signature and get session
  const verifyResult = await verifySignatureHandler({
    walletAddress: wallet.address,
    signature,
    challenge: challengeResult.challenge,
  });

  if (!verifyResult.success || !verifyResult.sessionId) {
    throw new Error(`Authentication failed: ${verifyResult.error}`);
  }

  return {
    sessionId: verifyResult.sessionId,
    walletAddress: verifyResult.walletAddress as `0x${string}`,
    isRegistered: verifyResult.isRegistered ?? false,
  };
}

// ============================================================================
// Contract Interaction Helpers
// ============================================================================

/**
 * Register an agent on-chain
 */
export async function registerAgentOnChain(
  wallet: TestWallet,
  agentURI: string
): Promise<`0x${string}`> {
  const hash = await wallet.walletClient.writeContract({
    address: addresses.agentAdapter,
    abi: ClawboyAgentAdapterABI,
    functionName: 'register',
    args: [agentURI],
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Agent registration transaction failed');
  }

  gasTracker.track('register', receipt.gasUsed, receipt.effectiveGasPrice);

  return hash;
}

/**
 * Check if an address is registered on-chain
 */
export async function checkAgentRegistered(address: `0x${string}`): Promise<boolean> {
  const publicClient = getPublicClient(CHAIN_ID);

  return publicClient.readContract({
    address: addresses.agentAdapter,
    abi: ClawboyAgentAdapterABI,
    functionName: 'isRegistered',
    args: [address],
  }) as Promise<boolean>;
}

/**
 * Create a task on-chain with ETH bounty
 */
export async function createTaskOnChain(
  wallet: TestWallet,
  specificationCid: string,
  bountyEth: string,
  deadlineSeconds: number = 7 * 24 * 60 * 60 // Default 7 days
): Promise<{ hash: `0x${string}`; taskId: bigint }> {
  const bountyWei = parseEther(bountyEth);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  const hash = await wallet.walletClient.writeContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'createTask',
    args: [specificationCid, ZERO_ADDRESS, bountyWei, deadline],
    value: bountyWei, // Send ETH with the transaction
  });

  // Wait for transaction receipt with retries
  const publicClient = getPublicClient(CHAIN_ID);
  const txReceipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 60_000, // 60 second timeout
  });

  if (txReceipt.status !== 'success') {
    throw new Error('Task creation transaction failed');
  }

  gasTracker.track('createTask', txReceipt.gasUsed, txReceipt.effectiveGasPrice);

  // Parse TaskCreated event to get taskId
  let taskId: bigint | undefined;

  for (const log of txReceipt.logs) {
    if (log.address.toLowerCase() === addresses.taskManager.toLowerCase()) {
      // The first indexed parameter in TaskCreated is taskId
      if (log.topics[1]) {
        taskId = BigInt(log.topics[1]);
        break;
      }
    }
  }

  if (taskId === undefined) {
    // Fallback: get task count and assume it's the latest
    const taskCount = await publicClient.readContract({
      address: addresses.taskManager,
      abi: TaskManagerABI,
      functionName: 'taskCount',
    });
    taskId = (taskCount as bigint) - 1n;
  }

  return { hash, taskId };
}

/**
 * Submit work for a task on-chain (competitive model - no claiming)
 */
export async function submitWorkOnChain(
  wallet: TestWallet,
  taskId: bigint,
  submissionCid: string
): Promise<`0x${string}`> {
  const hash = await wallet.walletClient.writeContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'submitWork',
    args: [taskId, submissionCid],
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Work submission transaction failed');
  }

  gasTracker.track('submitWork', receipt.gasUsed, receipt.effectiveGasPrice);

  return hash;
}

/**
 * Select winner for a task on-chain (creator only)
 */
export async function selectWinnerOnChain(
  wallet: TestWallet,
  taskId: bigint,
  winnerAddress: `0x${string}`
): Promise<`0x${string}`> {
  const hash = await wallet.walletClient.writeContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'selectWinner',
    args: [taskId, winnerAddress],
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Select winner transaction failed');
  }

  gasTracker.track('selectWinner', receipt.gasUsed, receipt.effectiveGasPrice);

  return hash;
}

/**
 * Get task data from chain
 */
export async function getTaskFromChain(taskId: bigint): Promise<{
  id: bigint;
  creator: `0x${string}`;
  status: number;
  bountyAmount: bigint;
  specificationCid: string;
  selectedWinner: `0x${string}`;
  submissionCount: bigint;
}> {
  const publicClient = getPublicClient(CHAIN_ID);

  const result = await publicClient.readContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'getTask',
    args: [taskId],
  });

  // viem can return as array or object depending on version/config
  // Handle both cases for robustness
  if (Array.isArray(result)) {
    // Array format: [id, creator, status, bountyAmount, bountyToken, specificationCid, createdAtBlock, deadline, selectedWinner, selectedAt, challengeDeadline]
    return {
      id: result[0] as bigint,
      creator: result[1] as `0x${string}`,
      status: result[2] as number,
      bountyAmount: result[3] as bigint,
      specificationCid: result[5] as string,
      selectedWinner: result[8] as `0x${string}`,
      submissionCount: 0n,
    };
  }

  // Object format with named properties matching ABI
  const task = result as {
    id: bigint;
    creator: `0x${string}`;
    status: number;
    bountyAmount: bigint;
    bountyToken: `0x${string}`;
    specificationCid: string;
    createdAtBlock: bigint;
    deadline: bigint;
    selectedWinner: `0x${string}`;
    selectedAt: bigint;
    challengeDeadline: bigint;
  };

  return {
    id: task.id,
    creator: task.creator,
    status: task.status,
    bountyAmount: task.bountyAmount,
    specificationCid: task.specificationCid,
    selectedWinner: task.selectedWinner,
    submissionCount: 0n,
  };
}

// ============================================================================
// Database Helpers
// ============================================================================

/**
 * Wait for a task to appear in the database (after indexer sync)
 * Filters by both chainTaskId and chainId to properly separate tasks from different chains
 */
export async function waitForTaskInDB(
  chainTaskId: bigint,
  maxWaitMs: number = 30000,
  pollIntervalMs: number = 2000,
  creatorAddress?: `0x${string}`
): Promise<Awaited<ReturnType<typeof getTaskByChainId>>> {
  const startTime = Date.now();
  const chainTaskIdStr = chainTaskId.toString();

  while (Date.now() - startTime < maxWaitMs) {
    // Pass CHAIN_ID to filter by chain, avoiding cross-chain collisions
    const task = await getTaskByChainId(chainTaskIdStr, CHAIN_ID);
    if (task) {
      // Optionally verify creator if provided (extra safety check)
      if (creatorAddress) {
        if (task.creator_address.toLowerCase() === creatorAddress.toLowerCase()) {
          return task;
        }
        // Task found but wrong creator - keep waiting for the right one
      } else {
        return task;
      }
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Task ${chainTaskIdStr} (chain: ${CHAIN_ID})${creatorAddress ? ` (creator: ${creatorAddress})` : ''} not found in database after ${maxWaitMs}ms`
  );
}

/**
 * Wait for a task status to update in the database
 * Filters by chainId to properly separate tasks from different chains
 */
export async function waitForTaskStatus(
  chainTaskId: bigint,
  expectedStatus: string,
  maxWaitMs: number = 30000,
  pollIntervalMs: number = 2000,
  creatorAddress?: `0x${string}`
): Promise<Awaited<ReturnType<typeof getTaskByChainId>>> {
  const startTime = Date.now();
  const chainTaskIdStr = chainTaskId.toString();

  while (Date.now() - startTime < maxWaitMs) {
    // Pass CHAIN_ID to filter by chain
    const task = await getTaskByChainId(chainTaskIdStr, CHAIN_ID);
    if (task) {
      // Optionally verify creator if provided (extra safety check)
      const creatorMatches =
        !creatorAddress || task.creator_address.toLowerCase() === creatorAddress.toLowerCase();

      if (creatorMatches && task.status === expectedStatus) {
        return task;
      }
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Task ${chainTaskIdStr} (chain: ${CHAIN_ID})${creatorAddress ? ` (creator: ${creatorAddress})` : ''} did not reach status "${expectedStatus}" after ${maxWaitMs}ms`
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reset all cached clients (useful between tests)
 */
export function resetClients(): void {
  resetPublicClient();
}

/**
 * Get the current chain ID being used for tests
 */
export function getTestChainId(): number {
  return CHAIN_ID;
}

/**
 * Check if tests are running against local Anvil
 */
export function isLocalAnvil(): boolean {
  return CHAIN_ID === 31337;
}

/**
 * Get chain name for logging
 */
export function getChainName(): string {
  return CHAIN_ID === 31337 ? 'Local Anvil' : 'Base Sepolia';
}

/**
 * Task status enum matching contract (competitive model)
 */
export const TaskStatus = {
  Open: 0,
  InReview: 1,
  Completed: 2,
  Disputed: 3,
  Refunded: 4,
  Cancelled: 5,
} as const;

/**
 * Convert task status number to string
 */
export function taskStatusToString(status: number): string {
  const statusNames: Record<number, string> = {
    0: 'open',
    1: 'in_review',
    2: 'completed',
    3: 'disputed',
    4: 'refunded',
    5: 'cancelled',
  };
  return statusNames[status] ?? 'unknown';
}

/**
 * TaskManager function names for competitive model
 */
export type TaskManagerFunction =
  | 'createTask'
  | 'submitWork'
  | 'selectWinner'
  | 'rejectAll'
  | 'finalizeTask'
  | 'cancelTask'
  | 'markDisputed'
  | 'resolveDispute';

// ============================================================================
// Additional Contract Interactions (for complete lifecycle testing)
// ============================================================================

/**
 * Finalize a task after the challenge window has passed
 * Note: On a real testnet, this requires waiting for the 48h challenge period
 * This function will fail if called before the challenge deadline
 */
export async function finalizeTaskOnChain(
  wallet: TestWallet,
  taskId: bigint
): Promise<`0x${string}`> {
  const hash = await wallet.walletClient.writeContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'finalizeTask',
    args: [taskId],
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Finalize task transaction failed');
  }

  gasTracker.track('finalizeTask', receipt.gasUsed, receipt.effectiveGasPrice);

  return hash;
}

/**
 * Get the challenge deadline for a task (useful for timing finalization)
 */
export async function getTaskChallengeDeadline(taskId: bigint): Promise<{
  deadline: Date;
  isPassed: boolean;
  remainingMs: number;
}> {
  const publicClient = getPublicClient(CHAIN_ID);

  // Read task to get challengeDeadline
  const result = await publicClient.readContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'getTask',
    args: [taskId],
  });

  // viem returns tuple as object with named properties
  const taskData = result as { challengeDeadline: bigint };
  const challengeDeadline = taskData.challengeDeadline;
  const deadlineMs = Number(challengeDeadline) * 1000;
  const now = Date.now();

  return {
    deadline: new Date(deadlineMs),
    isPassed: now > deadlineMs,
    remainingMs: Math.max(0, deadlineMs - now),
  };
}

/**
 * Wait for challenge deadline to pass (useful for manual testing)
 * Warning: This can take up to 48 hours on testnet!
 */
export async function waitForChallengeDeadline(
  taskId: bigint,
  pollIntervalMs: number = 60000 // Poll every minute
): Promise<void> {
  console.log('Waiting for challenge deadline...');
  console.log('Warning: This can take up to 48 hours on testnet!');

  let { isPassed, remainingMs } = await getTaskChallengeDeadline(taskId);

  while (!isPassed) {
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    console.log(`Remaining: ${hours}h ${minutes}m`);

    await sleep(pollIntervalMs);
    ({ isPassed, remainingMs } = await getTaskChallengeDeadline(taskId));
  }

  console.log('Challenge deadline has passed!');
}

// ============================================================================
// Additional Contract Interactions for E2E Testing
// ============================================================================

/**
 * Cancel a task on-chain (creator only, before submissions)
 */
export async function cancelTaskOnChain(
  wallet: TestWallet,
  taskId: bigint
): Promise<`0x${string}`> {
  const hash = await wallet.walletClient.writeContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'cancelTask',
    args: [taskId],
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Cancel task transaction failed');
  }

  gasTracker.track('cancelTask', receipt.gasUsed, receipt.effectiveGasPrice);

  return hash;
}

/**
 * Update agent profile on-chain
 */
export async function updateProfileOnChain(
  wallet: TestWallet,
  newURI: string
): Promise<`0x${string}`> {
  const hash = await wallet.walletClient.writeContract({
    address: addresses.agentAdapter,
    abi: ClawboyAgentAdapterABI,
    functionName: 'updateProfile',
    args: [newURI],
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Update profile transaction failed');
  }

  gasTracker.track('updateProfile', receipt.gasUsed, receipt.effectiveGasPrice);

  return hash;
}

/**
 * Get agent profile URI from chain (ERC-8004)
 * Returns the IPFS URI (ipfs://CID) or null if not registered
 */
export async function getAgentProfileURI(address: `0x${string}`): Promise<string | null> {
  const publicClient = getPublicClient(CHAIN_ID);

  try {
    // First check if registered
    const isRegistered = (await publicClient.readContract({
      address: addresses.agentAdapter,
      abi: ClawboyAgentAdapterABI,
      functionName: 'isRegistered',
      args: [address],
    })) as boolean;

    if (!isRegistered) {
      return null;
    }

    // Get agent ID
    const agentId = (await publicClient.readContract({
      address: addresses.agentAdapter,
      abi: ClawboyAgentAdapterABI,
      functionName: 'getAgentId',
      args: [address],
    })) as bigint;

    if (agentId === 0n) {
      return null;
    }

    // Get agent URI from identity registry
    const agentURI = (await publicClient.readContract({
      address: addresses.identityRegistry,
      abi: ERC8004IdentityRegistryABI,
      functionName: 'getAgentURI',
      args: [agentId],
    })) as string;

    return agentURI || null;
  } catch {
    return null;
  }
}

/**
 * @deprecated Use getAgentProfileURI instead
 * Get agent profile CID from chain (extracts CID from URI)
 */
export async function getAgentProfileCid(address: `0x${string}`): Promise<string | null> {
  const uri = await getAgentProfileURI(address);
  if (!uri) return null;
  // Extract CID from ipfs://CID format
  if (uri.startsWith('ipfs://')) {
    return uri.slice(7);
  }
  return uri;
}

// Re-export gasTracker for test files to print reports
export { gasTracker } from './gas-tracker';

// ============================================================================
// Anvil Time Manipulation (for testing time-dependent logic)
// ============================================================================

/**
 * Challenge window duration in seconds (48 hours)
 * Matches TaskManager.CHALLENGE_WINDOW
 */
export const CHALLENGE_WINDOW_SECONDS = 48 * 60 * 60; // 48 hours = 172,800 seconds

/**
 * Skip time on local Anvil by the specified number of seconds
 * Uses evm_increaseTime + evm_mine to advance blockchain time
 *
 * IMPORTANT: Only works on local Anvil (chainId 31337)
 * Will throw an error if called on testnet
 *
 * @param seconds - Number of seconds to advance time
 */
export async function skipTime(seconds: number): Promise<void> {
  if (!isLocalAnvil()) {
    throw new Error('Time manipulation only supported on local Anvil (chainId 31337)');
  }

  const { rpcUrl } = getChainConfig();

  // Advance time using raw RPC call (Anvil-specific method)
  const increaseTimeResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [seconds],
      id: 1,
    }),
  });

  const increaseTimeResult = await increaseTimeResponse.json();
  if (increaseTimeResult.error) {
    throw new Error(`evm_increaseTime failed: ${JSON.stringify(increaseTimeResult.error)}`);
  }

  // Mine a block to apply the time change
  const mineResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: 2,
    }),
  });

  const mineResult = await mineResponse.json();
  if (mineResult.error) {
    throw new Error(`evm_mine failed: ${JSON.stringify(mineResult.error)}`);
  }
}

/**
 * Skip past the challenge window (48 hours + 1 second)
 * Convenience function for finalizing tasks in tests
 */
export async function skipPastChallengeWindow(): Promise<void> {
  await skipTime(CHALLENGE_WINDOW_SECONDS + 1);
}
