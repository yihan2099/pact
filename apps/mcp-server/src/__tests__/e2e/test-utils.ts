/**
 * E2E Test Utilities for Task Lifecycle Tests
 *
 * Provides helper functions for:
 * - Wallet management (create, fund check)
 * - Authentication flow
 * - Contract interactions via viem
 * - Database queries
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
} from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  getPublicClient,
  resetPublicClient,
  getBalance,
  waitForTransaction,
} from '@porternetwork/web3-utils';
import {
  TaskManagerABI,
  PorterRegistryABI,
  getContractAddresses,
} from '@porternetwork/contracts';
import { getTaskByChainId } from '@porternetwork/database';

// Contract addresses on Base Sepolia
const CHAIN_ID = 84532;
const addresses = getContractAddresses(CHAIN_ID);

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
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
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
  profileCid: string
): Promise<`0x${string}`> {
  const hash = await wallet.walletClient.writeContract({
    address: addresses.porterRegistry,
    abi: PorterRegistryABI,
    functionName: 'register',
    args: [profileCid],
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Agent registration transaction failed');
  }

  return hash;
}

/**
 * Check if an address is registered on-chain
 */
export async function checkAgentRegistered(
  address: `0x${string}`
): Promise<boolean> {
  const publicClient = getPublicClient(CHAIN_ID);

  return publicClient.readContract({
    address: addresses.porterRegistry,
    abi: PorterRegistryABI,
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

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Task creation transaction failed');
  }

  // Get the task ID from the transaction logs
  const publicClient = getPublicClient(CHAIN_ID);
  const txReceipt = await publicClient.getTransactionReceipt({ hash });

  // Parse TaskCreated event to get taskId
  const taskCreatedTopic = '0x'; // We'll find it by iterating
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
 * Claim a task on-chain
 */
export async function claimTaskOnChain(
  wallet: TestWallet,
  taskId: bigint
): Promise<`0x${string}`> {
  const hash = await wallet.walletClient.writeContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'claimTask',
    args: [taskId],
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Task claim transaction failed');
  }

  return hash;
}

/**
 * Submit work for a task on-chain
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
  claimedBy: `0x${string}`;
  submissionCid: string;
}> {
  const publicClient = getPublicClient(CHAIN_ID);

  const result = await publicClient.readContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'getTask',
    args: [taskId],
  });

  const task = result as unknown as readonly [
    bigint,
    `0x${string}`,
    number,
    bigint,
    `0x${string}`,
    string,
    `0x${string}`,
    bigint,
    string,
    bigint,
    bigint
  ];

  return {
    id: task[0],
    creator: task[1],
    status: task[2],
    bountyAmount: task[3],
    specificationCid: task[5],
    claimedBy: task[6],
    submissionCid: task[8],
  };
}

// ============================================================================
// Database Helpers
// ============================================================================

/**
 * Wait for a task to appear in the database (after indexer sync)
 */
export async function waitForTaskInDB(
  chainTaskId: bigint,
  maxWaitMs: number = 30000,
  pollIntervalMs: number = 2000
): Promise<Awaited<ReturnType<typeof getTaskByChainId>>> {
  const startTime = Date.now();
  const chainTaskIdStr = chainTaskId.toString();

  while (Date.now() - startTime < maxWaitMs) {
    const task = await getTaskByChainId(chainTaskIdStr);
    if (task) {
      return task;
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Task ${chainTaskIdStr} not found in database after ${maxWaitMs}ms`
  );
}

/**
 * Wait for a task status to update in the database
 */
export async function waitForTaskStatus(
  chainTaskId: bigint,
  expectedStatus: string,
  maxWaitMs: number = 30000,
  pollIntervalMs: number = 2000
): Promise<Awaited<ReturnType<typeof getTaskByChainId>>> {
  const startTime = Date.now();
  const chainTaskIdStr = chainTaskId.toString();

  while (Date.now() - startTime < maxWaitMs) {
    const task = await getTaskByChainId(chainTaskIdStr);
    if (task && task.status === expectedStatus) {
      return task;
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Task ${chainTaskIdStr} did not reach status "${expectedStatus}" after ${maxWaitMs}ms`
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
 * Task status enum matching contract
 */
export const TaskStatus = {
  Open: 0,
  Claimed: 1,
  Submitted: 2,
  UnderVerification: 3,
  Completed: 4,
  Disputed: 5,
  Cancelled: 6,
  Expired: 7,
} as const;

/**
 * Convert task status number to string
 */
export function taskStatusToString(status: number): string {
  const statusNames: Record<number, string> = {
    0: 'open',
    1: 'claimed',
    2: 'submitted',
    3: 'under_verification',
    4: 'completed',
    5: 'disputed',
    6: 'cancelled',
    7: 'expired',
  };
  return statusNames[status] ?? 'unknown';
}
