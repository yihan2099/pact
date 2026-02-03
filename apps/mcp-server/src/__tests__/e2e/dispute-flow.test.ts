/**
 * End-to-End Dispute Flow Test
 *
 * Tests the complete dispute resolution lifecycle on Base Sepolia testnet:
 * 1. Create task and submit work
 * 2. Select winner (starts 48h challenge window)
 * 3. Start dispute (disputer stakes ETH)
 * 4. Submit votes (requires 3rd wallet as voter)
 * 5. Resolve dispute after voting period
 * 6. Verify final state
 *
 * Prerequisites:
 * - Three funded wallets on Base Sepolia
 * - MCP server running (bun run dev:mcp)
 * - Indexer running (bun run dev:indexer)
 * - All three agents must be registered on-chain
 *
 * Environment Variables:
 * - E2E_CREATOR_PRIVATE_KEY: Private key for task creator wallet
 * - E2E_AGENT_PRIVATE_KEY: Private key for winner agent wallet
 * - E2E_VOTER_PRIVATE_KEY: Private key for voter wallet (must be registered)
 *
 * Note: Due to the 48h voting period on testnet, this test may need to be run
 * in stages or with time manipulation on a local Anvil node.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { formatEther, parseEther } from 'viem';
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
  getTaskFromChain,
  waitForTaskInDB,
  waitForTaskStatus,
  sleep,
  resetClients,
  TaskStatus,
  taskStatusToString,
  type TestWallet,
} from './test-utils';

import { getContractAddresses, DisputeResolverABI, TaskManagerABI } from '@clawboy/contracts';
import { getPublicClient, waitForTransaction } from '@clawboy/web3-utils';

// MCP Tool handlers
import { registerAgentTool } from '../../tools/agent/register-agent';
import { createTaskTool } from '../../tools/task/create-task';
import { submitWorkTool } from '../../tools/agent/submit-work';
import { startDisputeTool } from '../../tools/dispute/start-dispute';
import { submitVoteTool } from '../../tools/dispute/submit-vote';
import { resolveDisputeTool } from '../../tools/dispute/resolve-dispute';
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
const TEST_BOUNTY_ETH = '0.002'; // Higher bounty to ensure minimum stake is meaningful
const INDEXER_SYNC_WAIT_MS = 15000;
const CHAIN_ID = 84532;

// Environment variables
const CREATOR_PRIVATE_KEY = process.env.E2E_CREATOR_PRIVATE_KEY as `0x${string}` | undefined;
const AGENT_PRIVATE_KEY = process.env.E2E_AGENT_PRIVATE_KEY as `0x${string}` | undefined;
const VOTER_PRIVATE_KEY = process.env.E2E_VOTER_PRIVATE_KEY as `0x${string}` | undefined;

const shouldSkipTests =
  !CREATOR_PRIVATE_KEY ||
  !AGENT_PRIVATE_KEY ||
  !VOTER_PRIVATE_KEY ||
  !CREATOR_PRIVATE_KEY.startsWith('0x') ||
  !AGENT_PRIVATE_KEY.startsWith('0x') ||
  !VOTER_PRIVATE_KEY.startsWith('0x');

/**
 * Start a dispute on-chain
 */
async function startDisputeOnChain(
  wallet: TestWallet,
  taskId: bigint,
  stakeWei: bigint
): Promise<{ hash: `0x${string}`; disputeId: bigint }> {
  const addresses = getContractAddresses(CHAIN_ID);

  const hash = await wallet.walletClient.writeContract({
    address: addresses.disputeResolver,
    abi: DisputeResolverABI,
    functionName: 'startDispute',
    args: [taskId],
    value: stakeWei,
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Start dispute transaction failed');
  }

  // Get dispute ID from events
  const publicClient = getPublicClient(CHAIN_ID);
  const txReceipt = await publicClient.getTransactionReceipt({ hash });

  let disputeId: bigint | undefined;
  for (const log of txReceipt.logs) {
    if (log.address.toLowerCase() === addresses.disputeResolver.toLowerCase()) {
      if (log.topics[1]) {
        disputeId = BigInt(log.topics[1]);
        break;
      }
    }
  }

  if (disputeId === undefined) {
    // Fallback: get dispute count
    const disputeCount = await publicClient.readContract({
      address: addresses.disputeResolver,
      abi: DisputeResolverABI,
      functionName: 'disputeCount',
    });
    disputeId = (disputeCount as bigint) - 1n;
  }

  return { hash, disputeId };
}

/**
 * Submit a vote on-chain
 */
async function submitVoteOnChain(
  wallet: TestWallet,
  disputeId: bigint,
  supportsDisputer: boolean
): Promise<`0x${string}`> {
  const addresses = getContractAddresses(CHAIN_ID);

  const hash = await wallet.walletClient.writeContract({
    address: addresses.disputeResolver,
    abi: DisputeResolverABI,
    functionName: 'submitVote',
    args: [disputeId, supportsDisputer],
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Submit vote transaction failed');
  }

  return hash;
}

/**
 * Resolve a dispute on-chain
 */
async function resolveDisputeOnChain(
  wallet: TestWallet,
  disputeId: bigint
): Promise<`0x${string}`> {
  const addresses = getContractAddresses(CHAIN_ID);

  const hash = await wallet.walletClient.writeContract({
    address: addresses.disputeResolver,
    abi: DisputeResolverABI,
    functionName: 'resolveDispute',
    args: [disputeId],
  });

  const receipt = await waitForTransaction(hash, CHAIN_ID);
  if (receipt.status !== 'success') {
    throw new Error('Resolve dispute transaction failed');
  }

  return hash;
}

/**
 * Get dispute data from chain
 */
async function getDisputeFromChain(disputeId: bigint): Promise<{
  id: bigint;
  taskId: bigint;
  disputer: `0x${string}`;
  disputeStake: bigint;
  votingDeadline: bigint;
  status: number;
  disputerWon: boolean;
  votesForDisputer: bigint;
  votesAgainstDisputer: bigint;
}> {
  const publicClient = getPublicClient(CHAIN_ID);
  const addresses = getContractAddresses(CHAIN_ID);

  const result = await publicClient.readContract({
    address: addresses.disputeResolver,
    abi: DisputeResolverABI,
    functionName: 'getDispute',
    args: [disputeId],
  });

  const dispute = result as unknown as readonly [
    bigint,
    bigint,
    `0x${string}`,
    bigint,
    bigint,
    number,
    boolean,
    bigint,
    bigint
  ];

  return {
    id: dispute[0],
    taskId: dispute[1],
    disputer: dispute[2],
    disputeStake: dispute[3],
    votingDeadline: dispute[4],
    status: dispute[5],
    disputerWon: dispute[6],
    votesForDisputer: dispute[7],
    votesAgainstDisputer: dispute[8],
  };
}

/**
 * Get minimum dispute stake
 */
async function getMinDisputeStake(): Promise<bigint> {
  const publicClient = getPublicClient(CHAIN_ID);
  const addresses = getContractAddresses(CHAIN_ID);

  return publicClient.readContract({
    address: addresses.disputeResolver,
    abi: DisputeResolverABI,
    functionName: 'MIN_DISPUTE_STAKE',
  }) as Promise<bigint>;
}

describe.skipIf(shouldSkipTests)('E2E: Dispute Flow on Base Sepolia', () => {
  // Test state
  let creatorWallet: TestWallet;
  let agentWallet: TestWallet;
  let voterWallet: TestWallet;
  let creatorSessionId: string;
  let agentSessionId: string;
  let voterSessionId: string;
  let chainTaskId: bigint;
  let dbTaskId: string;
  let disputeId: bigint;
  let minStake: bigint;

  beforeAll(async () => {
    console.log('\n========================================');
    console.log('E2E Dispute Flow Test - Base Sepolia');
    console.log('========================================\n');

    resetClients();

    // Create wallets
    creatorWallet = createTestWallet(CREATOR_PRIVATE_KEY!);
    agentWallet = createTestWallet(AGENT_PRIVATE_KEY!);
    voterWallet = createTestWallet(VOTER_PRIVATE_KEY!);

    console.log(`Creator wallet: ${creatorWallet.address}`);
    console.log(`Agent wallet: ${agentWallet.address}`);
    console.log(`Voter wallet: ${voterWallet.address}`);
    console.log('');

    // Check balances (need more ETH for dispute flow)
    const creatorBalance = await checkWalletBalance(creatorWallet.address, 'creator');
    const agentBalance = await checkWalletBalance(agentWallet.address, 'agent');
    const voterBalance = await checkWalletBalance(voterWallet.address, 'agent');

    console.log(`Creator: ${formatBalanceCheck(creatorBalance)}`);
    console.log(`Agent: ${formatBalanceCheck(agentBalance)}`);
    console.log(`Voter: ${formatBalanceCheck(voterBalance)}`);
    console.log('');

    if (!creatorBalance.sufficient || !agentBalance.sufficient || !voterBalance.sufficient) {
      throw new Error(
        'All wallets need sufficient ETH for dispute flow testing. ' +
        'Get testnet ETH from https://www.alchemy.com/faucets/base-sepolia'
      );
    }

    // Get minimum stake for later
    minStake = await getMinDisputeStake();
    console.log(`Minimum dispute stake: ${formatEther(minStake)} ETH`);
  });

  test('Step 1: Authenticate all wallets', async () => {
    console.log('\n--- Step 1: Authentication ---\n');

    // Authenticate all three wallets
    const creatorAuth = await authenticateWallet(creatorWallet);
    creatorSessionId = creatorAuth.sessionId;
    console.log(`Creator session: ${creatorSessionId.substring(0, 8)}...`);

    const agentAuth = await authenticateWallet(agentWallet);
    agentSessionId = agentAuth.sessionId;
    console.log(`Agent session: ${agentSessionId.substring(0, 8)}...`);

    const voterAuth = await authenticateWallet(voterWallet);
    voterSessionId = voterAuth.sessionId;
    console.log(`Voter session: ${voterSessionId.substring(0, 8)}...`);

    expect(creatorSessionId).toBeDefined();
    expect(agentSessionId).toBeDefined();
    expect(voterSessionId).toBeDefined();
  });

  test('Step 2: Ensure all agents are registered', async () => {
    console.log('\n--- Step 2: Agent Registration Check ---\n');

    // Check and register agent if needed
    const agentRegistered = await checkAgentRegistered(agentWallet.address);
    console.log(`Agent registered: ${agentRegistered}`);

    if (!agentRegistered) {
      console.log('Registering agent...');
      const profileResult = await registerAgentTool.handler(
        {
          name: `E2E Test Agent ${Date.now()}`,
          description: 'Test agent for dispute flow',
          skills: ['testing'],
          preferredTaskTypes: ['code'],
        },
        { callerAddress: agentWallet.address }
      );
      await registerAgentOnChain(agentWallet, profileResult.profileCid);
    }

    // Check and register voter if needed
    const voterRegistered = await checkAgentRegistered(voterWallet.address);
    console.log(`Voter registered: ${voterRegistered}`);

    if (!voterRegistered) {
      console.log('Registering voter...');
      const profileResult = await registerAgentTool.handler(
        {
          name: `E2E Test Voter ${Date.now()}`,
          description: 'Test voter for dispute flow',
          skills: ['review'],
          preferredTaskTypes: ['document'],
        },
        { callerAddress: voterWallet.address }
      );
      await registerAgentOnChain(voterWallet, profileResult.profileCid);
    }

    // Verify both are registered
    expect(await checkAgentRegistered(agentWallet.address)).toBe(true);
    expect(await checkAgentRegistered(voterWallet.address)).toBe(true);
  });

  test('Step 3: Create task and submit work', async () => {
    console.log('\n--- Step 3: Create Task & Submit Work ---\n');

    // Create task specification
    const taskResult = await createTaskTool.handler(
      {
        title: `E2E Dispute Test Task ${Date.now()}`,
        description: 'Task for testing dispute resolution flow',
        deliverables: [
          {
            type: 'document' as const,
            description: 'Test deliverable',
            format: 'text',
          },
        ],
        bountyAmount: TEST_BOUNTY_ETH,
        tags: ['test', 'dispute'],
      },
      { callerAddress: creatorWallet.address }
    );

    // Create task on-chain
    const { hash, taskId } = await createTaskOnChain(
      creatorWallet,
      taskResult.specificationCid,
      TEST_BOUNTY_ETH
    );
    chainTaskId = taskId;
    console.log(`Task created: ${chainTaskId}`);

    // Wait for indexer
    console.log('Waiting for indexer sync...');
    const dbTask = await waitForTaskInDB(chainTaskId, INDEXER_SYNC_WAIT_MS);
    dbTaskId = dbTask!.id;
    console.log(`Database task ID: ${dbTaskId}`);

    // Submit work from agent
    const submitResult = await submitWorkTool.handler(
      {
        taskId: dbTaskId,
        summary: 'Test submission for dispute flow',
        description: 'This submission will be disputed',
        deliverables: [
          {
            type: 'document' as const,
            description: 'Test output',
            url: 'https://example.com/test',
          },
        ],
      },
      { callerAddress: agentWallet.address }
    );

    await submitWorkOnChain(agentWallet, chainTaskId, submitResult.submissionCid);
    console.log('Work submitted on-chain');

    expect(chainTaskId).toBeGreaterThan(0n);
    expect(dbTaskId).toBeDefined();
  });

  test('Step 4: Select winner (starts challenge window)', async () => {
    console.log('\n--- Step 4: Select Winner ---\n');

    // Select agent as winner
    const txHash = await selectWinnerOnChain(creatorWallet, chainTaskId, agentWallet.address);
    console.log(`Winner selected: ${txHash}`);

    // Verify task is in review
    const onChainTask = await getTaskFromChain(chainTaskId);
    console.log(`Task status: ${taskStatusToString(onChainTask.status)}`);
    console.log(`Selected winner: ${onChainTask.selectedWinner}`);

    expect(onChainTask.status).toBe(TaskStatus.InReview);
    expect(onChainTask.selectedWinner.toLowerCase()).toBe(agentWallet.address.toLowerCase());

    // Wait for indexer
    await waitForTaskStatus(chainTaskId, 'in_review', INDEXER_SYNC_WAIT_MS);
  });

  test('Step 5: Start dispute via MCP tool (validation)', async () => {
    console.log('\n--- Step 5: Start Dispute (MCP Validation) ---\n');

    // Use MCP tool to validate and get required stake
    // Note: In a real scenario, we'd need a DIFFERENT agent to dispute
    // For testing, we'll demonstrate the validation flow
    // The agent who submitted can dispute if they believe the selection was wrong

    // Actually, the disputer must be a submitter, which our agent is
    // But normally a LOSING submitter would dispute, not the winner
    // For this test, let's have the voter submit work too, then dispute

    // First, have voter submit work so they can dispute
    const voterSubmitResult = await submitWorkTool.handler(
      {
        taskId: dbTaskId,
        summary: 'Competing submission for dispute test',
        description: 'This submitter will dispute the winner selection',
        deliverables: [
          {
            type: 'document' as const,
            description: 'Alternative submission',
            url: 'https://example.com/alt',
          },
        ],
      },
      { callerAddress: voterWallet.address }
    );

    await submitWorkOnChain(voterWallet, chainTaskId, voterSubmitResult.submissionCid);
    console.log('Voter submitted competing work');

    // Now voter can dispute (as a non-winning submitter)
    const disputeInfo = await startDisputeTool.handler(
      { taskId: chainTaskId.toString() },
      createMockContext(voterWallet.address, voterSessionId)
    );

    console.log(`Required stake: ${disputeInfo.requiredStake} ETH`);
    console.log(`Voting period: ${disputeInfo.votingPeriodHours} hours`);

    expect(disputeInfo.taskId).toBe(chainTaskId.toString());
    expect(disputeInfo.requiredStakeWei).toBeDefined();
  });

  test('Step 6: Start dispute on-chain', async () => {
    console.log('\n--- Step 6: Start Dispute On-Chain ---\n');

    // Calculate stake (max of 1% bounty or min stake)
    const bountyWei = parseEther(TEST_BOUNTY_ETH);
    const percentStake = bountyWei / 100n;
    const requiredStake = percentStake > minStake ? percentStake : minStake;

    console.log(`Using stake: ${formatEther(requiredStake)} ETH`);

    // Start dispute on-chain (voter is the disputer)
    const { hash, disputeId: dId } = await startDisputeOnChain(
      voterWallet,
      chainTaskId,
      requiredStake
    );
    disputeId = dId;
    console.log(`Dispute started: ${hash}`);
    console.log(`Dispute ID: ${disputeId}`);

    // Verify dispute state
    const dispute = await getDisputeFromChain(disputeId);
    console.log(`Dispute status: ${dispute.status}`); // 0 = Active
    console.log(`Voting deadline: ${new Date(Number(dispute.votingDeadline) * 1000).toISOString()}`);

    expect(dispute.id).toBe(disputeId);
    expect(dispute.taskId).toBe(chainTaskId);
    expect(dispute.disputer.toLowerCase()).toBe(voterWallet.address.toLowerCase());
    expect(dispute.status).toBe(0); // Active

    // Verify task is now disputed
    const onChainTask = await getTaskFromChain(chainTaskId);
    console.log(`Task status: ${taskStatusToString(onChainTask.status)}`);
    expect(onChainTask.status).toBe(TaskStatus.Disputed);
  });

  test('Step 7: Submit vote via MCP tool (validation)', async () => {
    console.log('\n--- Step 7: Submit Vote (MCP Validation) ---\n');

    // Note: Creator and disputer cannot vote
    // We need a 4th wallet, or we test the validation error case
    // For this test, we'll verify the validation logic

    // Try to vote as disputer (should fail)
    try {
      await submitVoteTool.handler(
        { disputeId: disputeId.toString(), supportsDisputer: true },
        createMockContext(voterWallet.address, voterSessionId)
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Expected error for disputer voting: ${errorMessage}`);
      expect(errorMessage).toContain('Disputer cannot vote');
    }

    // Try to vote as creator (should fail)
    try {
      await submitVoteTool.handler(
        { disputeId: disputeId.toString(), supportsDisputer: false },
        createMockContext(creatorWallet.address, creatorSessionId)
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Expected error for creator voting: ${errorMessage}`);
      expect(errorMessage).toContain('creator cannot vote');
    }

    // Agent (winner) should be able to vote
    const voteInfo = await submitVoteTool.handler(
      { disputeId: disputeId.toString(), supportsDisputer: false }, // Winner votes against disputer
      createMockContext(agentWallet.address, agentSessionId)
    );

    console.log(`Vote weight: ${voteInfo.yourVoteWeight}`);
    console.log(`Vote position: ${voteInfo.votePosition}`);

    expect(voteInfo.disputeId).toBe(disputeId.toString());
  });

  test('Step 8: Submit vote on-chain', async () => {
    console.log('\n--- Step 8: Submit Vote On-Chain ---\n');

    // Agent votes against disputer
    const txHash = await submitVoteOnChain(agentWallet, disputeId, false);
    console.log(`Vote submitted: ${txHash}`);

    // Verify vote was recorded
    const dispute = await getDisputeFromChain(disputeId);
    console.log(`Votes for disputer: ${dispute.votesForDisputer}`);
    console.log(`Votes against disputer: ${dispute.votesAgainstDisputer}`);

    expect(dispute.votesAgainstDisputer).toBeGreaterThan(0n);
  });

  test('Final verification: Dispute state check', async () => {
    console.log('\n--- Final Verification ---\n');

    // Get final dispute state
    const dispute = await getDisputeFromChain(disputeId);
    console.log('Dispute state:');
    console.log(`  ID: ${dispute.id}`);
    console.log(`  Task ID: ${dispute.taskId}`);
    console.log(`  Disputer: ${dispute.disputer}`);
    console.log(`  Stake: ${formatEther(dispute.disputeStake)} ETH`);
    console.log(`  Status: ${dispute.status}`);
    console.log(`  Votes For: ${dispute.votesForDisputer}`);
    console.log(`  Votes Against: ${dispute.votesAgainstDisputer}`);
    console.log(`  Voting Deadline: ${new Date(Number(dispute.votingDeadline) * 1000).toISOString()}`);

    // Get task state
    const task = await getTaskFromChain(chainTaskId);
    console.log('\nTask state:');
    console.log(`  Status: ${taskStatusToString(task.status)}`);
    console.log(`  Selected Winner: ${task.selectedWinner}`);

    console.log('\n========================================');
    console.log('Dispute Flow Test Complete!');
    console.log('========================================');
    console.log('\nNote: Full dispute resolution requires waiting for');
    console.log('the voting period to end (default 48h on testnet).');
    console.log('To complete the test:');
    console.log('1. Wait for voting deadline to pass');
    console.log('2. Call resolveDispute(disputeId)');
    console.log('3. Verify final task and dispute state');
    console.log('========================================\n');

    expect(dispute.status).toBe(0); // Active
    expect(task.status).toBe(TaskStatus.Disputed);
  });

  // Note: Resolution test is commented because it requires waiting for voting period
  /*
  test('Step 9: Resolve dispute (after voting period)', async () => {
    console.log('\n--- Step 9: Resolve Dispute ---\n');

    // Check if voting period has passed
    const dispute = await getDisputeFromChain(disputeId);
    const now = BigInt(Math.floor(Date.now() / 1000));

    if (now < dispute.votingDeadline) {
      console.log('Voting period not yet ended. Skipping resolution.');
      return;
    }

    // Resolve the dispute
    const txHash = await resolveDisputeOnChain(agentWallet, disputeId);
    console.log(`Dispute resolved: ${txHash}`);

    // Verify final state
    const finalDispute = await getDisputeFromChain(disputeId);
    console.log(`Disputer won: ${finalDispute.disputerWon}`);
    console.log(`Final status: ${finalDispute.status}`); // 1 = Resolved

    expect(finalDispute.status).toBe(1);
  });
  */
});

// Export for manual testing
export async function runDisputeFlowTest(): Promise<void> {
  console.log('Run this test with:');
  console.log('E2E_CREATOR_PRIVATE_KEY="0x..." \\');
  console.log('E2E_AGENT_PRIVATE_KEY="0x..." \\');
  console.log('E2E_VOTER_PRIVATE_KEY="0x..." \\');
  console.log('bun test src/__tests__/e2e/dispute-flow.test.ts');
}
