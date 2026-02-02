/**
 * End-to-End Task Lifecycle Test
 *
 * Tests the complete task lifecycle on Base Sepolia testnet:
 * 1. Auth: Challenge + Sign + Verify → sessionId
 * 2. Register: MCP register_agent → On-chain register()
 * 3. Create Task: MCP create_task → On-chain createTask()
 * 4. Claim Task: MCP claim_task → On-chain claimTask()
 * 5. Submit Work: MCP submit_work → On-chain submitWork()
 *
 * Note: Verification step (6-7) is skipped because it requires Elite tier agents
 * which need 1000+ reputation - not available on fresh testnet.
 *
 * Prerequisites:
 * - Two funded wallets on Base Sepolia (set via env vars)
 * - MCP server running (bun run dev:mcp)
 * - Indexer running (bun run dev:indexer)
 *
 * Environment Variables:
 * - E2E_CREATOR_PRIVATE_KEY: Private key for task creator wallet
 * - E2E_AGENT_PRIVATE_KEY: Private key for agent wallet
 *
 * Get testnet ETH from:
 * - https://www.alchemy.com/faucets/base-sepolia
 * - https://faucet.quicknode.com/base/sepolia
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { formatEther } from 'viem';
import {
  createTestWallet,
  checkWalletBalance,
  formatBalanceCheck,
  authenticateWallet,
  registerAgentOnChain,
  checkAgentRegistered,
  createTaskOnChain,
  claimTaskOnChain,
  submitWorkOnChain,
  getTaskFromChain,
  waitForTaskInDB,
  waitForTaskStatus,
  sleep,
  resetClients,
  TaskStatus,
  taskStatusToString,
  type TestWallet,
} from './test-utils';

// MCP Tool handlers
import { registerAgentTool } from '../../tools/agent/register-agent';
import { createTaskTool } from '../../tools/task/create-task';
import { claimTaskTool } from '../../tools/agent/claim-task';
import { submitWorkTool } from '../../tools/agent/submit-work';

// Test configuration
const TEST_BOUNTY_ETH = '0.001'; // Small bounty for testing
const INDEXER_SYNC_WAIT_MS = 15000; // Wait for indexer to sync

// Skip test if environment variables are not set
const CREATOR_PRIVATE_KEY = process.env.E2E_CREATOR_PRIVATE_KEY as
  | `0x${string}`
  | undefined;
const AGENT_PRIVATE_KEY = process.env.E2E_AGENT_PRIVATE_KEY as
  | `0x${string}`
  | undefined;

const shouldSkipTests =
  !CREATOR_PRIVATE_KEY ||
  !AGENT_PRIVATE_KEY ||
  !CREATOR_PRIVATE_KEY.startsWith('0x') ||
  !AGENT_PRIVATE_KEY.startsWith('0x');

describe.skipIf(shouldSkipTests)('E2E: Task Lifecycle on Base Sepolia', () => {
  // Test state shared across tests
  let creatorWallet: TestWallet;
  let agentWallet: TestWallet;
  let creatorSessionId: string;
  let agentSessionId: string;
  let agentProfileCid: string;
  let taskSpecCid: string;
  let chainTaskId: bigint;
  let dbTaskId: string;
  let submissionCid: string;

  beforeAll(async () => {
    console.log('\n========================================');
    console.log('E2E Task Lifecycle Test - Base Sepolia');
    console.log('========================================\n');

    // Reset any cached clients
    resetClients();

    // Create wallets from private keys
    creatorWallet = createTestWallet(CREATOR_PRIVATE_KEY!);
    agentWallet = createTestWallet(AGENT_PRIVATE_KEY!);

    console.log(`Creator wallet: ${creatorWallet.address}`);
    console.log(`Agent wallet: ${agentWallet.address}`);
    console.log('');

    // Check balances
    const creatorBalance = await checkWalletBalance(
      creatorWallet.address,
      'creator'
    );
    const agentBalance = await checkWalletBalance(agentWallet.address, 'agent');

    console.log(`Creator: ${formatBalanceCheck(creatorBalance)}`);
    console.log(`Agent: ${formatBalanceCheck(agentBalance)}`);
    console.log('');

    if (!creatorBalance.sufficient) {
      throw new Error(
        `Creator wallet needs more ETH. Current: ${formatEther(creatorBalance.balance)} ETH, ` +
          `Required: ${formatEther(creatorBalance.required)} ETH. ` +
          'Get testnet ETH from https://www.alchemy.com/faucets/base-sepolia'
      );
    }

    if (!agentBalance.sufficient) {
      throw new Error(
        `Agent wallet needs more ETH. Current: ${formatEther(agentBalance.balance)} ETH, ` +
          `Required: ${formatEther(agentBalance.required)} ETH. ` +
          'Get testnet ETH from https://www.alchemy.com/faucets/base-sepolia'
      );
    }
  });

  test('Step 1: Authenticate both wallets', async () => {
    console.log('\n--- Step 1: Authentication ---\n');

    // Authenticate creator
    console.log('Authenticating creator wallet...');
    const creatorAuth = await authenticateWallet(creatorWallet);
    creatorSessionId = creatorAuth.sessionId;
    console.log(`Creator session: ${creatorSessionId.substring(0, 8)}...`);
    console.log(`Creator registered: ${creatorAuth.isRegistered}`);

    // Authenticate agent
    console.log('\nAuthenticating agent wallet...');
    const agentAuth = await authenticateWallet(agentWallet);
    agentSessionId = agentAuth.sessionId;
    console.log(`Agent session: ${agentSessionId.substring(0, 8)}...`);
    console.log(`Agent registered: ${agentAuth.isRegistered}`);

    expect(creatorSessionId).toBeDefined();
    expect(agentSessionId).toBeDefined();
    expect(creatorAuth.walletAddress.toLowerCase()).toBe(
      creatorWallet.address.toLowerCase()
    );
    expect(agentAuth.walletAddress.toLowerCase()).toBe(
      agentWallet.address.toLowerCase()
    );
  });

  test('Step 2: Register agent (if not already registered)', async () => {
    console.log('\n--- Step 2: Agent Registration ---\n');

    // Check if agent is already registered on-chain
    const isRegistered = await checkAgentRegistered(agentWallet.address);
    console.log(`Agent already registered on-chain: ${isRegistered}`);

    if (isRegistered) {
      console.log('Skipping registration - agent already registered');
      agentProfileCid = 'existing'; // Marker for already registered
      return;
    }

    // Create agent profile via MCP
    console.log('Creating agent profile via MCP...');
    const profileResult = await registerAgentTool.handler(
      {
        name: `E2E Test Agent ${Date.now()}`,
        description: 'Automated test agent for E2E lifecycle testing',
        skills: ['testing', 'development', 'automation'],
        preferredTaskTypes: ['code', 'document'],
      },
      { callerAddress: agentWallet.address }
    );

    agentProfileCid = profileResult.profileCid;
    console.log(`Profile CID: ${agentProfileCid}`);

    // Register on-chain
    console.log('Registering agent on-chain...');
    const txHash = await registerAgentOnChain(agentWallet, agentProfileCid);
    console.log(`Registration tx: ${txHash}`);

    // Verify registration
    const nowRegistered = await checkAgentRegistered(agentWallet.address);
    console.log(`Agent registered on-chain: ${nowRegistered}`);

    expect(nowRegistered).toBe(true);
    expect(agentProfileCid).toMatch(/^Qm|^bafy/); // IPFS CID format
  });

  test('Step 3: Create task with bounty', async () => {
    console.log('\n--- Step 3: Task Creation ---\n');

    // Create task specification via MCP
    console.log('Creating task specification via MCP...');
    const taskResult = await createTaskTool.handler(
      {
        title: `E2E Test Task ${Date.now()}`,
        description:
          'This is an automated E2E test task. It verifies the complete task lifecycle from creation through submission.',
        deliverables: [
          {
            type: 'code' as const,
            description: 'Test output file',
            format: 'text',
          },
        ],
        bountyAmount: TEST_BOUNTY_ETH,
        tags: ['test', 'e2e', 'automated'],
      },
      { callerAddress: creatorWallet.address }
    );

    taskSpecCid = taskResult.specificationCid;
    console.log(`Specification CID: ${taskSpecCid}`);

    // Create task on-chain
    console.log(`Creating task on-chain with ${TEST_BOUNTY_ETH} ETH bounty...`);
    const { hash, taskId } = await createTaskOnChain(
      creatorWallet,
      taskSpecCid,
      TEST_BOUNTY_ETH
    );
    chainTaskId = taskId;
    console.log(`Creation tx: ${hash}`);
    console.log(`Chain task ID: ${chainTaskId}`);

    // Verify on-chain state
    const onChainTask = await getTaskFromChain(chainTaskId);
    console.log(`On-chain status: ${taskStatusToString(onChainTask.status)}`);

    expect(onChainTask.status).toBe(TaskStatus.Open);
    expect(onChainTask.creator.toLowerCase()).toBe(
      creatorWallet.address.toLowerCase()
    );
    expect(onChainTask.specificationCid).toBe(taskSpecCid);
  });

  test('Step 4: Wait for indexer sync and verify database', async () => {
    console.log('\n--- Step 4: Indexer Sync ---\n');

    console.log(
      `Waiting for indexer to sync (up to ${INDEXER_SYNC_WAIT_MS / 1000}s)...`
    );
    const dbTask = await waitForTaskInDB(chainTaskId, INDEXER_SYNC_WAIT_MS);

    dbTaskId = dbTask!.id;
    console.log(`Database task ID: ${dbTaskId}`);
    console.log(`Database status: ${dbTask!.status}`);
    console.log(`Database title: ${dbTask!.title}`);

    expect(dbTask).toBeDefined();
    expect(dbTask!.chain_task_id).toBe(chainTaskId.toString());
    expect(dbTask!.status).toBe('open');
    expect(dbTask!.creator_address.toLowerCase()).toBe(
      creatorWallet.address.toLowerCase()
    );
  });

  test('Step 5: Agent claims the task', async () => {
    console.log('\n--- Step 5: Task Claim ---\n');

    // Claim via MCP (creates database record)
    console.log('Claiming task via MCP...');
    const claimResult = await claimTaskTool.handler(
      {
        taskId: dbTaskId,
        message: 'E2E test claim - automated test agent',
      },
      { callerAddress: agentWallet.address }
    );

    console.log(`Claim ID: ${claimResult.claimId}`);

    // Claim on-chain
    console.log('Claiming task on-chain...');
    const txHash = await claimTaskOnChain(agentWallet, chainTaskId);
    console.log(`Claim tx: ${txHash}`);

    // Verify on-chain state
    const onChainTask = await getTaskFromChain(chainTaskId);
    console.log(`On-chain status: ${taskStatusToString(onChainTask.status)}`);
    console.log(`Claimed by: ${onChainTask.claimedBy}`);

    expect(onChainTask.status).toBe(TaskStatus.Claimed);
    expect(onChainTask.claimedBy.toLowerCase()).toBe(
      agentWallet.address.toLowerCase()
    );

    // Wait for indexer to sync the claim
    console.log('\nWaiting for indexer to sync claim...');
    const dbTask = await waitForTaskStatus(
      chainTaskId,
      'claimed',
      INDEXER_SYNC_WAIT_MS
    );
    console.log(`Database status: ${dbTask!.status}`);

    expect(dbTask!.status).toBe('claimed');
    expect(dbTask!.claimed_by?.toLowerCase()).toBe(
      agentWallet.address.toLowerCase()
    );
  });

  test('Step 6: Agent submits work', async () => {
    console.log('\n--- Step 6: Work Submission ---\n');

    // Submit work via MCP (uploads to IPFS, updates database)
    console.log('Submitting work via MCP...');
    const submitResult = await submitWorkTool.handler(
      {
        taskId: dbTaskId,
        summary: 'E2E test work completed successfully',
        description:
          'This submission demonstrates the complete task lifecycle workflow.',
        deliverables: [
          {
            type: 'code' as const,
            description: 'Test output',
            url: 'https://example.com/test-output',
          },
        ],
        verifierNotes: 'Automated E2E test - please approve',
      },
      { callerAddress: agentWallet.address }
    );

    submissionCid = submitResult.submissionCid;
    console.log(`Submission CID: ${submissionCid}`);

    // Submit on-chain
    console.log('Submitting work on-chain...');
    const txHash = await submitWorkOnChain(
      agentWallet,
      chainTaskId,
      submissionCid
    );
    console.log(`Submit tx: ${txHash}`);

    // Verify on-chain state
    const onChainTask = await getTaskFromChain(chainTaskId);
    console.log(`On-chain status: ${taskStatusToString(onChainTask.status)}`);
    console.log(`Submission CID on-chain: ${onChainTask.submissionCid}`);

    expect(onChainTask.status).toBe(TaskStatus.Submitted);
    expect(onChainTask.submissionCid).toBe(submissionCid);

    // Wait for indexer to sync the submission
    console.log('\nWaiting for indexer to sync submission...');
    const dbTask = await waitForTaskStatus(
      chainTaskId,
      'submitted',
      INDEXER_SYNC_WAIT_MS
    );
    console.log(`Database status: ${dbTask!.status}`);
    console.log(`Database submission CID: ${dbTask!.submission_cid}`);

    expect(dbTask!.status).toBe('submitted');
    expect(dbTask!.submission_cid).toBe(submissionCid);
  });

  test('Final verification: Complete state check', async () => {
    console.log('\n--- Final Verification ---\n');

    // On-chain verification
    const onChainTask = await getTaskFromChain(chainTaskId);
    console.log('On-chain state:');
    console.log(`  Task ID: ${onChainTask.id}`);
    console.log(`  Status: ${taskStatusToString(onChainTask.status)}`);
    console.log(`  Creator: ${onChainTask.creator}`);
    console.log(`  Bounty: ${formatEther(onChainTask.bountyAmount)} ETH`);
    console.log(`  Claimed by: ${onChainTask.claimedBy}`);
    console.log(`  Spec CID: ${onChainTask.specificationCid}`);
    console.log(`  Submission CID: ${onChainTask.submissionCid}`);

    // Database verification
    const dbTask = await waitForTaskInDB(chainTaskId);
    console.log('\nDatabase state:');
    console.log(`  ID: ${dbTask!.id}`);
    console.log(`  Chain ID: ${dbTask!.chain_task_id}`);
    console.log(`  Status: ${dbTask!.status}`);
    console.log(`  Title: ${dbTask!.title}`);

    // Assertions
    expect(onChainTask.status).toBe(TaskStatus.Submitted);
    expect(dbTask!.status).toBe('submitted');
    expect(onChainTask.submissionCid).toBe(submissionCid);
    expect(dbTask!.submission_cid).toBe(submissionCid);

    console.log('\n========================================');
    console.log('E2E Test Complete!');
    console.log('========================================');
    console.log('\nNote: Verification step skipped - requires Elite tier agents');
    console.log(
      'To complete full lifecycle, add grantEliteStatus() to PorterRegistry'
    );
    console.log('========================================\n');
  });
});

// Also export a standalone test runner for manual testing
export async function runE2ETest(): Promise<void> {
  const creatorKey = process.env.E2E_CREATOR_PRIVATE_KEY as `0x${string}`;
  const agentKey = process.env.E2E_AGENT_PRIVATE_KEY as `0x${string}`;

  if (!creatorKey || !agentKey) {
    console.error('Missing environment variables:');
    console.error('  E2E_CREATOR_PRIVATE_KEY - Creator wallet private key');
    console.error('  E2E_AGENT_PRIVATE_KEY - Agent wallet private key');
    process.exit(1);
  }

  console.log('Running E2E test manually...');
  console.log('Use `bun test src/__tests__/e2e/task-lifecycle.test.ts` instead');
}
