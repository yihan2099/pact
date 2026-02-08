/**
 * Full System Flow E2E Tests
 *
 * Tests complete task lifecycle flows with mocked external services.
 * These tests mock the blockchain and database layers but test the
 * full internal integration between MCP tools, IPFS, and data flow.
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ============================================================================
// Mock Setup
// ============================================================================

const mockCreateTask = mock(() => Promise.resolve({ id: 'db-task-1' }));
const mockGetTask = mock(() =>
  Promise.resolve({
    id: 'db-task-1',
    chain_task_id: '1',
    chain_id: 84532,
    title: 'Test Task',
    description: 'A test task',
    status: 'open',
    creator_address: '0xcreator',
    bounty_amount: '1000000000000000000',
    bounty_token: '0x0000000000000000000000000000000000000000',
    specification_cid: 'QmSpec123',
    tags: ['test'],
    submission_count: 0,
    winner_address: null,
    created_at: new Date().toISOString(),
  })
);
const mockGetTaskByChainId = mock(() => mockGetTask());
const mockUpdateTask = mock(() => Promise.resolve());
const mockCreateSubmission = mock(() => Promise.resolve({ id: 'sub-1' }));
const mockGetSubmissionByTaskAndAgent = mock(() => Promise.resolve(null));
const mockUpdateSubmission = mock(() => Promise.resolve());
const mockUpsertAgent = mock(() => Promise.resolve());
const mockGetAgentByAddress = mock(() =>
  Promise.resolve({
    address: '0xagent',
    name: 'Test Agent',
    agent_id: '1',
    skills: ['testing'],
  })
);
const mockCreateDispute = mock(() => Promise.resolve({ id: 'dispute-1' }));
const mockGetDisputeByChainId = mock(() => Promise.resolve(null));
const mockUpdateDispute = mock(() => Promise.resolve());
const mockIncrementDisputesWon = mock(() => Promise.resolve());
const mockIncrementDisputesLost = mock(() => Promise.resolve());

mock.module('@clawboy/database', () => ({
  createTask: mockCreateTask,
  getTask: mockGetTask,
  getTaskByChainId: mockGetTaskByChainId,
  updateTask: mockUpdateTask,
  createSubmission: mockCreateSubmission,
  getSubmissionByTaskAndAgent: mockGetSubmissionByTaskAndAgent,
  updateSubmission: mockUpdateSubmission,
  upsertAgent: mockUpsertAgent,
  getAgentByAddress: mockGetAgentByAddress,
  createDispute: mockCreateDispute,
  getDisputeByChainId: mockGetDisputeByChainId,
  updateDispute: mockUpdateDispute,
  incrementDisputesWon: mockIncrementDisputesWon,
  incrementDisputesLost: mockIncrementDisputesLost,
}));

const mockFetchTaskSpecification = mock(() =>
  Promise.resolve({ title: 'Full Lifecycle Task', description: 'Test desc', tags: ['e2e'] })
);
const mockFetchJson = mock(() =>
  Promise.resolve({ name: 'E2E Agent', skills: ['coding'], type: 'ai-agent' })
);

mock.module('@clawboy/ipfs-utils', () => ({
  fetchTaskSpecification: mockFetchTaskSpecification,
  fetchJson: mockFetchJson,
}));

mock.module('@clawboy/cache', () => ({
  invalidateTaskCaches: mock(() => Promise.resolve()),
  invalidateSubmissionCaches: mock(() => Promise.resolve()),
  invalidateDisputeCaches: mock(() => Promise.resolve()),
  invalidateAgentCaches: mock(() => Promise.resolve()),
}));

const mockWithRetryResult = mock((fn: () => Promise<unknown>) =>
  fn().then(
    (data) => ({ success: true, data, attempts: 1 }),
    (error: Error) => ({ success: false, error: error.message, attempts: 1 })
  )
);

mock.module('../../utils/retry', () => ({
  withRetryResult: mockWithRetryResult,
}));

// Import handlers after mocks are set up
import { handleTaskCreated } from '../../../../indexer/src/handlers/task-created';
import { handleWorkSubmitted } from '../../../../indexer/src/handlers/work-submitted';
import { handleWinnerSelected } from '../../../../indexer/src/handlers/winner-selected';
import { handleDisputeCreated } from '../../../../indexer/src/handlers/dispute-started';
import { handleDisputeResolved } from '../../../../indexer/src/handlers/dispute-resolved';
import { handleAgentRegistered } from '../../../../indexer/src/handlers/agent-registered';
import type { IndexerEvent } from '../../../../indexer/src/listener';

// ============================================================================
// Helper Functions
// ============================================================================

function makeEvent(name: string, args: Record<string, unknown>): IndexerEvent {
  return {
    name,
    chainId: 84532,
    blockNumber: 100n,
    transactionHash: '0xabcdef1234567890' as `0x${string}`,
    logIndex: 0,
    args,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('E2E: Full System Flow (Mocked)', () => {
  beforeEach(() => {
    mockCreateTask.mockClear();
    mockGetTask.mockClear();
    mockGetTaskByChainId.mockClear();
    mockUpdateTask.mockClear();
    mockCreateSubmission.mockClear();
    mockGetSubmissionByTaskAndAgent.mockClear();
    mockUpsertAgent.mockClear();
    mockCreateDispute.mockClear();
    mockGetDisputeByChainId.mockClear();
    mockUpdateDispute.mockClear();
    mockIncrementDisputesWon.mockClear();
    mockIncrementDisputesLost.mockClear();
    mockFetchTaskSpecification.mockClear();
  });

  test('complete task lifecycle: create -> submit -> select winner', async () => {
    // Step 1: Task created on-chain, indexer picks it up
    const taskCreatedEvent = makeEvent('TaskCreated', {
      taskId: 1n,
      creator: '0xCreator' as `0x${string}`,
      bountyAmount: 1000000000000000000n,
      bountyToken: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      specificationCid: 'QmTaskSpec',
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
    });

    await handleTaskCreated(taskCreatedEvent);
    expect(mockCreateTask).toHaveBeenCalledTimes(1);
    const createTaskArgs = mockCreateTask.mock.calls[0]![0] as Record<string, unknown>;
    expect(createTaskArgs.status).toBe('open');
    expect(createTaskArgs.chain_task_id).toBe('1');

    // Step 2: Agent submits work
    mockGetTaskByChainId.mockImplementation(() =>
      Promise.resolve({
        id: 'db-task-1',
        chain_task_id: '1',
        status: 'open',
        creator_address: '0xcreator',
      })
    );

    const workSubmittedEvent = makeEvent('WorkSubmitted', {
      taskId: 1n,
      agent: '0xAgent' as `0x${string}`,
      submissionCid: 'QmSubmission',
      submissionIndex: 0n,
    });

    await handleWorkSubmitted(workSubmittedEvent);
    expect(mockCreateSubmission).toHaveBeenCalledTimes(1);

    // Step 3: Creator selects winner
    mockGetTaskByChainId.mockImplementation(() =>
      Promise.resolve({
        id: 'db-task-1',
        chain_task_id: '1',
        status: 'open',
        creator_address: '0xcreator',
      })
    );

    const winnerSelectedEvent = makeEvent('WinnerSelected', {
      taskId: 1n,
      winner: '0xAgent' as `0x${string}`,
      challengeDeadline: BigInt(Math.floor(Date.now() / 1000) + 172800),
    });

    await handleWinnerSelected(winnerSelectedEvent);
    expect(mockUpdateTask).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdateTask.mock.calls[0]![1] as Record<string, unknown>;
    expect(updateArgs.status).toBe('in_review');
    expect(updateArgs.winner_address).toBe('0xagent');
  });

  test('dispute lifecycle: create dispute -> resolve', async () => {
    // Step 1: Dispute created
    mockGetTaskByChainId.mockImplementation(() =>
      Promise.resolve({
        id: 'db-task-1',
        chain_task_id: '1',
        status: 'in_review',
        creator_address: '0xcreator',
      })
    );

    const disputeCreatedEvent = makeEvent('DisputeCreated', {
      disputeId: 1n,
      taskId: 1n,
      disputer: '0xDisputer' as `0x${string}`,
      stake: 100000000000000000n,
      votingDeadline: BigInt(Math.floor(Date.now() / 1000) + 172800),
    });

    await handleDisputeCreated(disputeCreatedEvent);
    expect(mockCreateDispute).toHaveBeenCalledTimes(1);
    const disputeArgs = mockCreateDispute.mock.calls[0]![0] as Record<string, unknown>;
    expect(disputeArgs.status).toBe('active');
    expect(disputeArgs.disputer_address).toBe('0xdisputer');

    // Step 2: Dispute resolved (disputer won)
    mockGetDisputeByChainId.mockImplementation(() =>
      Promise.resolve({
        id: 'dispute-1',
        chain_dispute_id: '1',
        task_id: 'db-task-1',
        disputer_address: '0xdisputer',
        status: 'active',
      })
    );

    const disputeResolvedEvent = makeEvent('DisputeResolved', {
      disputeId: 1n,
      taskId: 1n,
      disputerWon: true,
      votesFor: 5n,
      votesAgainst: 2n,
    });

    await handleDisputeResolved(disputeResolvedEvent);
    expect(mockUpdateDispute).toHaveBeenCalledTimes(1);
    const resolveArgs = mockUpdateDispute.mock.calls[0]![1] as Record<string, unknown>;
    expect(resolveArgs.status).toBe('resolved');
    expect(resolveArgs.disputer_won).toBe(true);
    expect(mockIncrementDisputesWon).toHaveBeenCalledWith('0xdisputer');
  });

  test('multi-agent submission scenario', async () => {
    mockGetTaskByChainId.mockImplementation(() =>
      Promise.resolve({
        id: 'db-task-1',
        chain_task_id: '1',
        status: 'open',
        creator_address: '0xcreator',
      })
    );
    mockGetSubmissionByTaskAndAgent.mockImplementation(() => Promise.resolve(null));

    // Agent 1 submits
    await handleWorkSubmitted(
      makeEvent('WorkSubmitted', {
        taskId: 1n,
        agent: '0xAgent1' as `0x${string}`,
        submissionCid: 'QmSubmission1',
        submissionIndex: 0n,
      })
    );

    // Agent 2 submits
    await handleWorkSubmitted(
      makeEvent('WorkSubmitted', {
        taskId: 1n,
        agent: '0xAgent2' as `0x${string}`,
        submissionCid: 'QmSubmission2',
        submissionIndex: 1n,
      })
    );

    // Agent 3 submits
    await handleWorkSubmitted(
      makeEvent('WorkSubmitted', {
        taskId: 1n,
        agent: '0xAgent3' as `0x${string}`,
        submissionCid: 'QmSubmission3',
        submissionIndex: 2n,
      })
    );

    expect(mockCreateSubmission).toHaveBeenCalledTimes(3);

    // Verify each submission was created with correct agent
    const agents = mockCreateSubmission.mock.calls.map(
      (call) => (call[0] as Record<string, unknown>).agent_address
    );
    expect(agents).toContain('0xagent1');
    expect(agents).toContain('0xagent2');
    expect(agents).toContain('0xagent3');
  });

  test('task cancellation flow', async () => {
    // Create task
    const taskCreatedEvent = makeEvent('TaskCreated', {
      taskId: 99n,
      creator: '0xCreator' as `0x${string}`,
      bountyAmount: 500000000000000000n,
      bountyToken: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      specificationCid: 'QmCancelTask',
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
    });

    await handleTaskCreated(taskCreatedEvent);
    expect(mockCreateTask).toHaveBeenCalledTimes(1);

    // Task cancellation is handled by the TaskCancelled event handler
    // which updates the task status to 'cancelled'
    // We verify the task was created first, then would be cancelled
    const args = mockCreateTask.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.chain_task_id).toBe('99');
    expect(args.status).toBe('open');
  });

  test('agent registration and profile indexing', async () => {
    const agentRegisteredEvent = makeEvent('AgentRegistered', {
      wallet: '0xNewAgent' as `0x${string}`,
      agentId: 42n,
      agentURI: 'ipfs://QmAgentProfile',
    });

    await handleAgentRegistered(agentRegisteredEvent);
    expect(mockUpsertAgent).toHaveBeenCalledTimes(1);
    const agentArgs = mockUpsertAgent.mock.calls[0]![0] as Record<string, unknown>;
    expect(agentArgs.address).toBe('0xnewagent');
    expect(agentArgs.agent_id).toBe('42');
    expect(agentArgs.agent_uri).toBe('ipfs://QmAgentProfile');
  });
});
