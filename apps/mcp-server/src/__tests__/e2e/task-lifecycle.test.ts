/**
 * End-to-End Task Lifecycle Test
 *
 * Tests the complete task lifecycle on Base Sepolia testnet:
 * 1. Auth: Challenge + Sign + Verify → sessionId
 * 2. Register: MCP register_agent → On-chain register()
 * 3. Create Task: MCP create_task → On-chain createTask()
 * 4. Submit Work: MCP submit_work → On-chain submitWork() (competitive - no claiming)
 * 5. Select Winner: On-chain selectWinner() (creator selects best submission)
 *
 * Updated for competitive task system with optimistic verification.
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

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { formatEther } from 'viem';
import {
  createTestWallet,
  checkWalletBalance,
  formatBalanceCheck,
  authenticateWallet,
  registerAgentOnChain,
  checkAgentRegistered,
  createTaskOnChain,
  submitWorkOnChain,
  selectWinnerOnChain,
  finalizeTaskOnChain,
  cancelTaskOnChain,
  getTaskChallengeDeadline,
  getTaskFromChain,
  waitForTaskInDB,
  waitForTaskStatus,
  sleep,
  resetClients,
  TaskStatus,
  taskStatusToString,
  gasTracker,
  type TestWallet,
} from './test-utils';

// MCP Tool handlers
import { registerAgentTool } from '../../tools/agent/register-agent';
import { createTaskTool } from '../../tools/task/create-task';
import { submitWorkTool } from '../../tools/agent/submit-work';
import { cancelTaskTool } from '../../tools/task/cancel-task';

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

// Longer timeout for testnet transactions (60 seconds per test)
const TEST_TIMEOUT = 60000;

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
    console.log('(Competitive Model - No Claiming)');
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

  test(
    'Step 2: Register agent (if not already registered)',
    async () => {
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
      expect(agentProfileCid).toMatch(/^Qm|^baf/); // IPFS CID format (CIDv0: Qm, CIDv1: baf*)
    },
    TEST_TIMEOUT
  );

  test(
    'Step 3: Create task with bounty',
    async () => {
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

      // Wait for state to propagate (RPC can be slow to update)
      await sleep(3000);

      // Verify on-chain state
      const onChainTask = await getTaskFromChain(chainTaskId);
      console.log(`On-chain status: ${taskStatusToString(onChainTask.status)}`);

      expect(onChainTask.status).toBe(TaskStatus.Open);
      expect(onChainTask.creator.toLowerCase()).toBe(
        creatorWallet.address.toLowerCase()
      );
      expect(onChainTask.specificationCid).toBe(taskSpecCid);
    },
    TEST_TIMEOUT
  );

  test(
    'Step 4: Wait for indexer sync and verify database',
    async () => {
      console.log('\n--- Step 4: Indexer Sync ---\n');

      console.log(
        `Waiting for indexer to sync (up to ${INDEXER_SYNC_WAIT_MS / 1000}s)...`
      );
      const dbTask = await waitForTaskInDB(chainTaskId, INDEXER_SYNC_WAIT_MS, 2000, creatorWallet.address);

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
    },
    TEST_TIMEOUT
  );

  test(
    'Step 5: Agent submits work (competitive - no claiming)',
    async () => {
      console.log('\n--- Step 5: Work Submission ---\n');

      // Submit work via MCP (uploads to IPFS, creates database record)
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
          creatorNotes: 'Automated E2E test - please approve',
        },
        { callerAddress: agentWallet.address }
      );

      submissionCid = submitResult.submissionCid;
      console.log(`Submission CID: ${submissionCid}`);
      console.log(`Is update: ${submitResult.isUpdate}`);

      // Submit on-chain
      console.log('Submitting work on-chain...');
      const txHash = await submitWorkOnChain(
        agentWallet,
        chainTaskId,
        submissionCid
      );
      console.log(`Submit tx: ${txHash}`);

      // Verify on-chain state (task should still be open until creator selects winner)
      const onChainTask = await getTaskFromChain(chainTaskId);
      console.log(`On-chain status: ${taskStatusToString(onChainTask.status)}`);

      // In competitive model, task stays open until deadline or creator selects
      expect(onChainTask.status).toBe(TaskStatus.Open);
    },
    TEST_TIMEOUT
  );

  test(
    'Step 6: Creator selects winner',
    async () => {
      console.log('\n--- Step 6: Winner Selection ---\n');

      // Select winner on-chain (agent who submitted)
      console.log('Selecting winner on-chain...');
      const txHash = await selectWinnerOnChain(
        creatorWallet,
        chainTaskId,
        agentWallet.address
      );
      console.log(`Select winner tx: ${txHash}`);

      // Wait for state to propagate (RPC can be slow to update)
      await sleep(3000);

      // Verify on-chain state
      const onChainTask = await getTaskFromChain(chainTaskId);
      console.log(`On-chain status: ${taskStatusToString(onChainTask.status)}`);
      console.log(`Selected winner: ${onChainTask.selectedWinner}`);

      // Task should now be in review (48h challenge window)
      expect(onChainTask.status).toBe(TaskStatus.InReview);
      expect(onChainTask.selectedWinner.toLowerCase()).toBe(
        agentWallet.address.toLowerCase()
      );

      // Wait for indexer to sync
      console.log('\nWaiting for indexer to sync winner selection...');
      const dbTask = await waitForTaskStatus(
        chainTaskId,
        'in_review',
        INDEXER_SYNC_WAIT_MS,
        2000,
        creatorWallet.address
      );
      console.log(`Database status: ${dbTask!.status}`);
      console.log(`Database winner: ${dbTask!.winner_address}`);

      expect(dbTask!.status).toBe('in_review');
      expect(dbTask!.winner_address?.toLowerCase()).toBe(
        agentWallet.address.toLowerCase()
      );
    },
    TEST_TIMEOUT
  );

  test(
    'Final verification: Complete state check',
    async () => {
      console.log('\n--- Final Verification ---\n');

      // On-chain verification
      const onChainTask = await getTaskFromChain(chainTaskId);
      console.log('On-chain state:');
      console.log(`  Task ID: ${onChainTask.id}`);
      console.log(`  Status: ${taskStatusToString(onChainTask.status)}`);
      console.log(`  Creator: ${onChainTask.creator}`);
      console.log(`  Bounty: ${formatEther(onChainTask.bountyAmount)} ETH`);
      console.log(`  Selected Winner: ${onChainTask.selectedWinner}`);
      console.log(`  Spec CID: ${onChainTask.specificationCid}`);

      // Database verification
      const dbTask = await waitForTaskInDB(chainTaskId, 30000, 2000, creatorWallet.address);
      console.log('\nDatabase state:');
      console.log(`  ID: ${dbTask!.id}`);
      console.log(`  Chain ID: ${dbTask!.chain_task_id}`);
      console.log(`  Status: ${dbTask!.status}`);
      console.log(`  Title: ${dbTask!.title}`);
      console.log(`  Winner: ${dbTask!.winner_address}`);
      console.log(`  Submission Count: ${dbTask!.submission_count}`);

      // Check challenge deadline
      const deadline = await getTaskChallengeDeadline(chainTaskId);
      console.log('\nChallenge window:');
      console.log(`  Deadline: ${deadline.deadline.toISOString()}`);
      console.log(`  Passed: ${deadline.isPassed}`);
      if (!deadline.isPassed) {
        const hours = Math.floor(deadline.remainingMs / (60 * 60 * 1000));
        const minutes = Math.floor(
          (deadline.remainingMs % (60 * 60 * 1000)) / (60 * 1000)
        );
        console.log(`  Remaining: ${hours}h ${minutes}m`);
      }

      // Assertions
      expect(onChainTask.status).toBe(TaskStatus.InReview);
      expect(dbTask!.status).toBe('in_review');
      expect(dbTask!.winner_address?.toLowerCase()).toBe(
        agentWallet.address.toLowerCase()
      );

      console.log('\n========================================');
      console.log('E2E Test Complete!');
      console.log('========================================');
      console.log('\nTask is now in 48h challenge window.');
      console.log('After challenge period, call finalizeTask() to complete.');
      console.log('========================================\n');
    },
    TEST_TIMEOUT
  );

});

/**
 * Task Cancellation Tests
 *
 * These tests run independently and create separate tasks for cancellation testing
 */
describe.skipIf(shouldSkipTests)('E2E: Task Cancellation on Base Sepolia', () => {
  let creatorWallet: TestWallet;
  let agentWallet: TestWallet;
  let creatorSessionId: string;
  let agentSessionId: string;

  beforeAll(async () => {
    console.log('\n========================================');
    console.log('E2E Task Cancellation Test - Base Sepolia');
    console.log('========================================\n');

    resetClients();

    creatorWallet = createTestWallet(CREATOR_PRIVATE_KEY!);
    agentWallet = createTestWallet(AGENT_PRIVATE_KEY!);

    console.log(`Creator wallet: ${creatorWallet.address}`);
    console.log(`Agent wallet: ${agentWallet.address}`);

    // Authenticate wallets
    const creatorAuth = await authenticateWallet(creatorWallet);
    creatorSessionId = creatorAuth.sessionId;

    const agentAuth = await authenticateWallet(agentWallet);
    agentSessionId = agentAuth.sessionId;

    // Ensure agent is registered
    const isRegistered = await checkAgentRegistered(agentWallet.address);
    if (!isRegistered) {
      const profileResult = await registerAgentTool.handler(
        {
          name: `E2E Cancel Test Agent ${Date.now()}`,
          description: 'Test agent for cancellation tests',
          skills: ['testing'],
          preferredTaskTypes: ['code'],
        },
        { callerAddress: agentWallet.address }
      );
      await registerAgentOnChain(agentWallet, profileResult.profileCid);
    }
  });

  test(
    'Test 8: Creator cancels task before submissions',
    async () => {
      console.log('\n--- Test 8: Creator cancels task before submissions ---\n');

      // Create a new task for cancellation
      const taskResult = await createTaskTool.handler(
        {
          title: `E2E Cancellation Test Task ${Date.now()}`,
          description: 'Task to be cancelled - testing cancellation flow',
          deliverables: [
            {
              type: 'document' as const,
              description: 'Test output',
              format: 'text',
            },
          ],
          bountyAmount: TEST_BOUNTY_ETH,
          tags: ['test', 'cancel'],
        },
        { callerAddress: creatorWallet.address }
      );

      const { hash, taskId: chainTaskId } = await createTaskOnChain(
        creatorWallet,
        taskResult.specificationCid,
        TEST_BOUNTY_ETH
      );
      console.log(`Task created: ${chainTaskId}`);

      // Wait for indexer sync
      await sleep(3000);
      const dbTask = await waitForTaskInDB(chainTaskId, INDEXER_SYNC_WAIT_MS, 2000, creatorWallet.address);
      console.log(`Database task ID: ${dbTask!.id}`);
      console.log(`Database status: ${dbTask!.status}`);

      expect(dbTask!.status).toBe('open');

      // Call MCP cancel_task tool
      console.log('Calling MCP cancel_task tool...');
      const cancelResult = await cancelTaskTool.handler(
        { taskId: dbTask!.id, reason: 'E2E test - testing cancellation flow' },
        { callerAddress: creatorWallet.address }
      );
      console.log(`MCP result: ${cancelResult.message}`);

      expect(cancelResult.nextStep).toBeDefined();

      // Cancel on-chain
      console.log('Cancelling task on-chain...');
      const cancelTxHash = await cancelTaskOnChain(creatorWallet, chainTaskId);
      console.log(`Cancel tx: ${cancelTxHash}`);

      // Wait for state propagation
      await sleep(3000);

      // Verify on-chain state
      const onChainTask = await getTaskFromChain(chainTaskId);
      console.log(`On-chain status: ${taskStatusToString(onChainTask.status)}`);

      expect(onChainTask.status).toBe(TaskStatus.Cancelled);

      // Wait for indexer to sync the cancelled status
      const updatedDbTask = await waitForTaskStatus(
        chainTaskId,
        'cancelled',
        INDEXER_SYNC_WAIT_MS,
        2000,
        creatorWallet.address
      );
      console.log(`Database status after cancel: ${updatedDbTask!.status}`);

      expect(updatedDbTask!.status).toBe('cancelled');

      console.log('Task successfully cancelled');
    },
    TEST_TIMEOUT
  );

  test(
    'Test 9: Cannot cancel task after submission',
    async () => {
      console.log('\n--- Test 9: Cannot cancel task after submission ---\n');

      // Create a task
      const taskResult = await createTaskTool.handler(
        {
          title: `E2E No-Cancel After Submit ${Date.now()}`,
          description: 'Task that will receive a submission before cancel attempt',
          deliverables: [
            {
              type: 'code' as const,
              description: 'Test output',
              format: 'text',
            },
          ],
          bountyAmount: TEST_BOUNTY_ETH,
          tags: ['test'],
        },
        { callerAddress: creatorWallet.address }
      );

      const { taskId: chainTaskId } = await createTaskOnChain(
        creatorWallet,
        taskResult.specificationCid,
        TEST_BOUNTY_ETH
      );
      console.log(`Task created: ${chainTaskId}`);

      await sleep(3000);
      const dbTask = await waitForTaskInDB(chainTaskId, INDEXER_SYNC_WAIT_MS, 2000, creatorWallet.address);

      // Submit work
      console.log('Agent submitting work...');
      const submitResult = await submitWorkTool.handler(
        {
          taskId: dbTask!.id,
          summary: 'Test submission to prevent cancellation',
          description: 'Work submitted',
          deliverables: [
            {
              type: 'code' as const,
              description: 'Output',
              url: 'https://example.com/test',
            },
          ],
        },
        { callerAddress: agentWallet.address }
      );
      await submitWorkOnChain(agentWallet, chainTaskId, submitResult.submissionCid);
      console.log('Work submitted on-chain');

      // Task is still open but has submissions
      // Contract should reject cancellation
      console.log('Attempting to cancel task with submissions...');

      try {
        await cancelTaskOnChain(creatorWallet, chainTaskId);
        // If we get here, the contract allowed cancellation (unexpected)
        console.log('Warning: Contract allowed cancellation after submission');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error: ${errorMessage.substring(0, 100)}...`);
        // Expected - contract should reject
        expect(
          errorMessage.includes('revert') ||
            errorMessage.includes('fail') ||
            errorMessage.includes('submission')
        ).toBe(true);
      }

      // Verify task is still open
      const onChainTask = await getTaskFromChain(chainTaskId);
      console.log(`Task status (should be Open): ${taskStatusToString(onChainTask.status)}`);
      expect(onChainTask.status).toBe(TaskStatus.Open);

      console.log('Cancellation correctly rejected after submission');
    },
    TEST_TIMEOUT
  );

  test(
    'Test 10: Non-creator cannot cancel',
    async () => {
      console.log('\n--- Test 10: Non-creator cannot cancel ---\n');

      // Create a task as creator
      const taskResult = await createTaskTool.handler(
        {
          title: `E2E Non-Creator Cancel Test ${Date.now()}`,
          description: 'Task that agent will try to cancel',
          deliverables: [
            {
              type: 'document' as const,
              description: 'Test',
            },
          ],
          bountyAmount: TEST_BOUNTY_ETH,
          tags: ['test'],
        },
        { callerAddress: creatorWallet.address }
      );

      const { taskId: chainTaskId } = await createTaskOnChain(
        creatorWallet,
        taskResult.specificationCid,
        TEST_BOUNTY_ETH
      );
      console.log(`Task created by creator: ${chainTaskId}`);

      await sleep(3000);
      const dbTask = await waitForTaskInDB(chainTaskId, INDEXER_SYNC_WAIT_MS, 2000, creatorWallet.address);

      // Agent tries to cancel via MCP tool
      console.log('Agent attempting to cancel creator task via MCP...');

      try {
        await cancelTaskTool.handler(
          { taskId: dbTask!.id },
          { callerAddress: agentWallet.address }
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected MCP error: ${errorMessage}`);
        expect(errorMessage).toContain('Only the task creator can cancel');
      }

      // Verify task is unchanged
      const onChainTask = await getTaskFromChain(chainTaskId);
      expect(onChainTask.status).toBe(TaskStatus.Open);

      console.log('Non-creator correctly denied cancellation');
    },
    TEST_TIMEOUT
  );

  test('Final summary', async () => {
    console.log('\n========================================');
    console.log('Task Cancellation Tests Complete!');
    console.log('========================================\n');
  });

  afterAll(() => {
    // Print gas report at the end of all E2E tests
    gasTracker.printReport();
  });

  // Note: The following test can only be run after the 48h challenge period
  // This is commented out because it requires waiting 48h on testnet
  // For a complete test, either:
  // 1. Deploy contracts with shorter challenge period for testing
  // 2. Run this test manually after the challenge period
  // 3. Use a local Foundry/Anvil node where time can be advanced
  /*
  test('Step 7: Finalize task after challenge period (manual)', async () => {
    console.log('\n--- Step 7: Task Finalization ---\n');

    // Check if challenge period has passed
    const deadline = await getTaskChallengeDeadline(chainTaskId);
    if (!deadline.isPassed) {
      console.log('Challenge period not yet passed');
      console.log(`Remaining: ${Math.floor(deadline.remainingMs / (60 * 60 * 1000))}h`);
      console.log('Skipping finalization test...');
      return;
    }

    // Finalize the task (releases bounty to winner)
    console.log('Finalizing task...');
    const txHash = await finalizeTaskOnChain(creatorWallet, chainTaskId);
    console.log(`Finalize tx: ${txHash}`);

    // Verify on-chain state
    const onChainTask = await getTaskFromChain(chainTaskId);
    console.log(`On-chain status: ${taskStatusToString(onChainTask.status)}`);

    expect(onChainTask.status).toBe(TaskStatus.Completed);

    // Wait for indexer to sync
    console.log('\nWaiting for indexer to sync finalization...');
    const dbTask = await waitForTaskStatus(
      chainTaskId,
      'completed',
      INDEXER_SYNC_WAIT_MS,
      2000,
      creatorWallet.address
    );
    console.log(`Database status: ${dbTask!.status}`);

    expect(dbTask!.status).toBe('completed');

    console.log('\n========================================');
    console.log('Task Lifecycle Complete!');
    console.log('Bounty released to winner.');
    console.log('========================================\n');
  });
  */
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
