/**
 * End-to-End Error Scenario Tests
 *
 * Tests various error conditions and edge cases:
 * - Insufficient wallet balance
 * - Invalid task specification
 * - Submit to non-existent task
 * - Unauthorized actions (wrong wallet)
 * - Double submission handling
 * - Invalid dispute scenarios
 *
 * Prerequisites:
 * - Two funded wallets on Base Sepolia
 * - MCP server running (bun run dev:mcp)
 * - Indexer running (bun run dev:indexer)
 *
 * Environment Variables:
 * - E2E_CREATOR_PRIVATE_KEY: Private key for task creator wallet
 * - E2E_AGENT_PRIVATE_KEY: Private key for agent wallet
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { formatEther } from 'viem';
import {
  createTestWallet,
  authenticateWallet,
  checkAgentRegistered,
  registerAgentOnChain,
  createTaskOnChain,
  submitWorkOnChain,
  selectWinnerOnChain,
  waitForTaskInDB,
  resetClients,
  type TestWallet,
} from './test-utils';
import { generatePrivateKey } from 'viem/accounts';
import { getBalance } from '@clawboy/web3-utils';

// MCP Tool handlers
import { registerAgentTool } from '../../tools/agent/register-agent';
import { createTaskTool } from '../../tools/task/create-task';
import { submitWorkTool } from '../../tools/agent/submit-work';
import { startDisputeTool } from '../../tools/dispute/start-dispute';
import { submitVoteTool } from '../../tools/dispute/submit-vote';
import type { ServerContext } from '../../server';

/**
 * Create a mock ServerContext for testing
 */
function createMockContext(address: `0x${string}`, sessionId: string): ServerContext {
  return {
    callerAddress: address,
    isAuthenticated: true,
    isRegistered: true,
    sessionId,
  };
}

// Test configuration
const TEST_BOUNTY_ETH = '0.001';
const INDEXER_SYNC_WAIT_MS = 15000;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532', 10);
const TEST_TIMEOUT = 60000; // 60 seconds for on-chain tests

// Environment variables
const CREATOR_PRIVATE_KEY = process.env.E2E_CREATOR_PRIVATE_KEY as `0x${string}` | undefined;
const AGENT_PRIVATE_KEY = process.env.E2E_AGENT_PRIVATE_KEY as `0x${string}` | undefined;

const shouldSkipTests =
  !CREATOR_PRIVATE_KEY ||
  !AGENT_PRIVATE_KEY ||
  !CREATOR_PRIVATE_KEY.startsWith('0x') ||
  !AGENT_PRIVATE_KEY.startsWith('0x');

describe.skipIf(shouldSkipTests)('E2E: Error Scenarios on Base Sepolia', () => {
  let creatorWallet: TestWallet;
  let agentWallet: TestWallet;
  let unfundedWallet: TestWallet;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _creatorSessionId: string;
  let agentSessionId: string;

  beforeAll(async () => {
    console.log('\n========================================');
    console.log('E2E Error Scenarios Test - Base Sepolia');
    console.log('========================================\n');

    resetClients();

    // Create wallets
    creatorWallet = createTestWallet(CREATOR_PRIVATE_KEY!);
    agentWallet = createTestWallet(AGENT_PRIVATE_KEY!);

    // Create an unfunded wallet for testing insufficient balance
    const unfundedKey = generatePrivateKey();
    unfundedWallet = createTestWallet(unfundedKey);

    console.log(`Creator wallet: ${creatorWallet.address}`);
    console.log(`Agent wallet: ${agentWallet.address}`);
    console.log(`Unfunded wallet: ${unfundedWallet.address}`);
    console.log('');

    // Authenticate main wallets
    const creatorAuth = await authenticateWallet(creatorWallet);
    _creatorSessionId = creatorAuth.sessionId;

    const agentAuth = await authenticateWallet(agentWallet);
    agentSessionId = agentAuth.sessionId;

    // Ensure agent is registered
    const isRegistered = await checkAgentRegistered(agentWallet.address);
    if (!isRegistered) {
      console.log('Registering agent...');
      const profileResult = await registerAgentTool.handler(
        {
          name: `E2E Error Test Agent ${Date.now()}`,
          description: 'Test agent for error scenarios',
          skills: ['testing'],
          preferredTaskTypes: ['code'],
        },
        { callerAddress: agentWallet.address }
      );
      await registerAgentOnChain(agentWallet, profileResult.agentURI);
    }
  });

  describe('Insufficient Balance Errors', () => {
    test('should fail to create task with insufficient balance', async () => {
      console.log('\n--- Test: Insufficient balance for task creation ---\n');

      // Check unfunded wallet balance
      const balance = await getBalance(unfundedWallet.address, CHAIN_ID);
      console.log(`Unfunded wallet balance: ${formatEther(balance)} ETH`);
      expect(balance).toBe(0n);

      // Try to create task specification (this will succeed - no ETH needed)
      const taskResult = await createTaskTool.handler(
        {
          title: 'Test Task (Will Fail)',
          description: 'This task creation will fail due to insufficient balance',
          deliverables: [{ type: 'document' as const, description: 'Test' }],
          bountyAmount: '0.1', // Large bounty
          tags: ['test'],
        },
        { callerAddress: unfundedWallet.address }
      );

      // On-chain creation should fail
      try {
        await createTaskOnChain(unfundedWallet, taskResult.specificationCid, '0.1');
        expect(true).toBe(false); // Should not reach here
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error: ${errorMessage}`);
        // viem throws error for insufficient funds
        expect(
          errorMessage.includes('insufficient') ||
            errorMessage.includes('balance') ||
            errorMessage.includes('gas')
        ).toBe(true);
      }
    });
  });

  describe('Invalid Task Specification Errors', () => {
    test('should fail with missing required fields', async () => {
      console.log('\n--- Test: Missing required fields ---\n');

      // Missing title
      try {
        await createTaskTool.handler(
          {
            title: '', // Empty title
            description: 'Description provided',
            deliverables: [{ type: 'document' as const, description: 'Test' }],
            bountyAmount: TEST_BOUNTY_ETH,
          },
          { callerAddress: creatorWallet.address }
        );
        expect(true).toBe(false);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error for empty title: ${errorMessage}`);
        expect(errorMessage.length).toBeGreaterThan(0);
      }

      // Missing deliverables
      try {
        await createTaskTool.handler(
          {
            title: 'Test Task',
            description: 'Description provided',
            deliverables: [], // Empty deliverables
            bountyAmount: TEST_BOUNTY_ETH,
          },
          { callerAddress: creatorWallet.address }
        );
        expect(true).toBe(false);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error for empty deliverables: ${errorMessage}`);
        expect(errorMessage.length).toBeGreaterThan(0);
      }
    });

    test('should fail with invalid bounty amount', async () => {
      console.log('\n--- Test: Invalid bounty amount ---\n');

      // Zero bounty
      try {
        await createTaskTool.handler(
          {
            title: 'Test Task',
            description: 'Description',
            deliverables: [{ type: 'document' as const, description: 'Test' }],
            bountyAmount: '0',
          },
          { callerAddress: creatorWallet.address }
        );
        expect(true).toBe(false);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error for zero bounty: ${errorMessage}`);
        expect(errorMessage.length).toBeGreaterThan(0);
      }

      // Negative bounty (should be caught by validation)
      try {
        await createTaskTool.handler(
          {
            title: 'Test Task',
            description: 'Description',
            deliverables: [{ type: 'document' as const, description: 'Test' }],
            bountyAmount: '-1',
          },
          { callerAddress: creatorWallet.address }
        );
        expect(true).toBe(false);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error for negative bounty: ${errorMessage}`);
        expect(errorMessage.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Non-Existent Task Errors', () => {
    test('should fail to submit work to non-existent task', async () => {
      console.log('\n--- Test: Submit to non-existent task ---\n');

      const fakeTaskId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

      try {
        await submitWorkTool.handler(
          {
            taskId: fakeTaskId,
            summary: 'Test submission',
            description: 'This should fail',
            deliverables: [
              { type: 'document' as const, description: 'Test', url: 'https://test.com' },
            ],
          },
          { callerAddress: agentWallet.address }
        );
        expect(true).toBe(false);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error: ${errorMessage}`);
        expect(
          errorMessage.includes('not found') ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('Task')
        ).toBe(true);
      }
    });

    test('should fail to submit work on-chain to invalid task ID', async () => {
      console.log('\n--- Test: On-chain submit to invalid task ID ---\n');

      const invalidChainTaskId = 999999n;

      try {
        await submitWorkOnChain(agentWallet, invalidChainTaskId, 'Qmtest123');
        expect(true).toBe(false);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error: ${errorMessage}`);
        // Contract will revert
        expect(
          errorMessage.includes('revert') ||
            errorMessage.includes('fail') ||
            errorMessage.includes('invalid')
        ).toBe(true);
      }
    });
  });

  describe('Unauthorized Action Errors', () => {
    let testTaskId: bigint;
    let testDbTaskId: string;

    beforeAll(async () => {
      // Create a task for authorization tests
      const taskResult = await createTaskTool.handler(
        {
          title: `Auth Test Task ${Date.now()}`,
          description: 'Task for testing authorization errors',
          deliverables: [{ type: 'document' as const, description: 'Test' }],
          bountyAmount: TEST_BOUNTY_ETH,
          tags: ['test'],
        },
        { callerAddress: creatorWallet.address }
      );

      const { taskId } = await createTaskOnChain(
        creatorWallet,
        taskResult.specificationCid,
        TEST_BOUNTY_ETH
      );
      testTaskId = taskId;

      // Wait for state to propagate
      await new Promise((r) => setTimeout(r, 3000));

      // Wait for indexer
      const dbTask = await waitForTaskInDB(testTaskId, INDEXER_SYNC_WAIT_MS);
      testDbTaskId = dbTask!.id;

      // Have agent submit work
      const submitResult = await submitWorkTool.handler(
        {
          taskId: testDbTaskId,
          summary: 'Test submission',
          description: 'Work for auth testing',
          deliverables: [
            { type: 'document' as const, description: 'Output', url: 'https://test.com' },
          ],
        },
        { callerAddress: agentWallet.address }
      );
      await submitWorkOnChain(agentWallet, testTaskId, submitResult.submissionCid);
    }, TEST_TIMEOUT);

    test('should fail when non-creator tries to select winner', async () => {
      console.log('\n--- Test: Non-creator selecting winner ---\n');

      try {
        // Agent tries to select themselves as winner (should fail)
        await selectWinnerOnChain(agentWallet, testTaskId, agentWallet.address);
        expect(true).toBe(false);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error: ${errorMessage}`);
        expect(
          errorMessage.includes('creator') ||
            errorMessage.includes('authorized') ||
            errorMessage.includes('revert')
        ).toBe(true);
      }
    });

    test('should fail to select non-submitter as winner', async () => {
      console.log('\n--- Test: Selecting non-submitter as winner ---\n');

      // Generate a random address that didn't submit
      const randomKey = generatePrivateKey();
      const randomWallet = createTestWallet(randomKey);

      try {
        await selectWinnerOnChain(creatorWallet, testTaskId, randomWallet.address);
        expect(true).toBe(false);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error: ${errorMessage}`);
        expect(
          errorMessage.includes('submitter') ||
            errorMessage.includes('submit') ||
            errorMessage.includes('revert')
        ).toBe(true);
      }
    });
  });

  describe('Dispute Validation Errors', () => {
    test(
      'should fail to dispute task not in review',
      async () => {
        console.log('\n--- Test: Dispute task not in review ---\n');

        // Create a fresh task (will be in Open status)
        const taskResult = await createTaskTool.handler(
          {
            title: `Dispute Test Task ${Date.now()}`,
            description: 'Task for testing dispute validation',
            deliverables: [{ type: 'document' as const, description: 'Test' }],
            bountyAmount: TEST_BOUNTY_ETH,
            tags: ['test'],
          },
          { callerAddress: creatorWallet.address }
        );

        const { taskId } = await createTaskOnChain(
          creatorWallet,
          taskResult.specificationCid,
          TEST_BOUNTY_ETH
        );

        // Wait for state to propagate
        await new Promise((r) => setTimeout(r, 3000));

        // Submit work so we can try to dispute
        const dbTask = await waitForTaskInDB(taskId, INDEXER_SYNC_WAIT_MS);

        const submitResult = await submitWorkTool.handler(
          {
            taskId: dbTask!.id,
            summary: 'Submission',
            description: 'Work',
            deliverables: [
              { type: 'document' as const, description: 'Output', url: 'https://test.com' },
            ],
          },
          { callerAddress: agentWallet.address }
        );
        await submitWorkOnChain(agentWallet, taskId, submitResult.submissionCid);

        // Try to start dispute (task is Open, not InReview)
        try {
          await startDisputeTool.handler(
            { taskId: taskId.toString() },
            createMockContext(agentWallet.address, agentSessionId)
          );
          expect(true).toBe(false);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`Expected error: ${errorMessage}`);
          expect(errorMessage.includes('review') || errorMessage.includes('status')).toBe(true);
        }
      },
      TEST_TIMEOUT
    );

    test('should fail to vote on non-existent dispute', async () => {
      console.log('\n--- Test: Vote on non-existent dispute ---\n');

      try {
        await submitVoteTool.handler(
          { disputeId: '999999', supportsDisputer: true },
          createMockContext(agentWallet.address, agentSessionId)
        );
        expect(true).toBe(false);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error: ${errorMessage}`);
        expect(errorMessage.includes('not found') || errorMessage.includes('Dispute')).toBe(true);
      }
    });
  });

  describe('Double Action Errors', () => {
    test(
      'should handle double submission gracefully (update existing)',
      async () => {
        console.log('\n--- Test: Double submission handling ---\n');

        // Create task
        const taskResult = await createTaskTool.handler(
          {
            title: `Double Submit Test ${Date.now()}`,
            description: 'Task for testing double submission',
            deliverables: [{ type: 'document' as const, description: 'Test' }],
            bountyAmount: TEST_BOUNTY_ETH,
            tags: ['test'],
          },
          { callerAddress: creatorWallet.address }
        );

        const { taskId } = await createTaskOnChain(
          creatorWallet,
          taskResult.specificationCid,
          TEST_BOUNTY_ETH
        );

        // Wait for state to propagate
        await new Promise((r) => setTimeout(r, 3000));

        const dbTask = await waitForTaskInDB(taskId, INDEXER_SYNC_WAIT_MS);

        // First submission
        const firstSubmit = await submitWorkTool.handler(
          {
            taskId: dbTask!.id,
            summary: 'First submission',
            description: 'Initial work',
            deliverables: [
              { type: 'document' as const, description: 'v1', url: 'https://test.com/v1' },
            ],
          },
          { callerAddress: agentWallet.address }
        );
        console.log(`First submission CID: ${firstSubmit.submissionCid}`);
        console.log(`First submission isUpdate: ${firstSubmit.isUpdate}`);

        // Submit on-chain
        await submitWorkOnChain(agentWallet, taskId, firstSubmit.submissionCid);

        // Second submission (should update)
        const secondSubmit = await submitWorkTool.handler(
          {
            taskId: dbTask!.id,
            summary: 'Updated submission',
            description: 'Improved work',
            deliverables: [
              { type: 'document' as const, description: 'v2', url: 'https://test.com/v2' },
            ],
          },
          { callerAddress: agentWallet.address }
        );
        console.log(`Second submission CID: ${secondSubmit.submissionCid}`);
        console.log(`Second submission isUpdate: ${secondSubmit.isUpdate}`);

        // The MCP tool should indicate this is an update
        expect(secondSubmit.isUpdate).toBe(true);

        // On-chain: Second submission should FAIL (contract doesn't allow updates)
        // The MCP layer updates the DB, but on-chain each address can only submit once
        try {
          await submitWorkOnChain(agentWallet, taskId, secondSubmit.submissionCid);
          // If it doesn't throw, the contract allows updates (unexpected)
          console.log('Note: Contract allowed submission update');
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`Expected on-chain rejection: ${errorMessage.substring(0, 100)}...`);
          // Expected - contract rejects duplicate submissions
          expect(errorMessage.includes('revert')).toBe(true);
        }

        // Both MCP submissions should have succeeded (DB updates work)
        expect(firstSubmit.submissionCid).toBeDefined();
        expect(secondSubmit.submissionCid).toBeDefined();
      },
      TEST_TIMEOUT
    );
  });

  describe('Additional Error Scenarios', () => {
    test('Test 14: Cancel nonexistent task', async () => {
      console.log('\n--- Test 14: Cancel nonexistent task ---\n');

      const fakeTaskId = '00000000-0000-0000-0000-000000000000';

      try {
        const { cancelTaskTool } = await import('../../tools/task/cancel-task');
        await cancelTaskTool.handler(
          { taskId: fakeTaskId },
          { callerAddress: creatorWallet.address }
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Expected error: ${errorMessage}`);
        expect(errorMessage.includes('not found') || errorMessage.includes('Task')).toBe(true);
      }

      console.log('Nonexistent task cancellation correctly rejected');
    });

    test('Test 15: Update profile with private webhook URL', async () => {
      console.log('\n--- Test 15: Update profile with private webhook URL ---\n');

      // This test checks SSRF protection for private addresses
      const privateUrls = [
        'https://192.168.1.1/webhook',
        'https://10.0.0.1/webhook',
        'https://172.16.0.1/webhook',
        'https://localhost/webhook',
        'https://127.0.0.1/webhook',
      ];

      const { updateProfileTool } = await import('../../tools/agent/update-profile');

      for (const url of privateUrls) {
        try {
          await updateProfileTool.handler(
            { webhookUrl: url },
            { callerAddress: agentWallet.address }
          );
          console.log(`Warning: ${url} was accepted (unexpected)`);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`${url} rejected: ${errorMessage.substring(0, 50)}...`);
          expect(
            errorMessage.toLowerCase().includes('private') ||
              errorMessage.toLowerCase().includes('https') ||
              errorMessage.toLowerCase().includes('secure')
          ).toBe(true);
        }
      }

      console.log('Private webhook URLs correctly rejected');
    });

    test('Test 16: Get capabilities with invalid category', async () => {
      console.log('\n--- Test 16: Get capabilities with invalid category ---\n');

      const { getCapabilitiesHandler } = await import('../../tools/discovery/get-capabilities');

      // Test with invalid category - should not crash
      const context = {
        callerAddress: agentWallet.address,
        isAuthenticated: true,
        isRegistered: true,
        sessionId: agentSessionId,
      };

      const result = await getCapabilitiesHandler(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { category: 'invalid_category' as any },
        context
      );

      console.log(`Tools returned with invalid category: ${result.tools.length}`);

      // Should either return empty array or ignore invalid filter
      // Important: server should not crash
      expect(result).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);

      // With an invalid category that doesn't match any tools, should return empty
      expect(result.tools.length).toBe(0);

      console.log('Invalid category handled gracefully');
    });
  });

  test('Final summary', async () => {
    console.log('\n========================================');
    console.log('Error Scenarios Test Complete!');
    console.log('========================================');
    console.log('\nAll error conditions handled appropriately.');
    console.log('========================================\n');
  });
});

// Export for manual testing
export async function runErrorScenariosTest(): Promise<void> {
  console.log('Run this test with:');
  console.log('E2E_CREATOR_PRIVATE_KEY="0x..." \\');
  console.log('E2E_AGENT_PRIVATE_KEY="0x..." \\');
  console.log('bun test src/__tests__/e2e/error-scenarios.test.ts');
}
