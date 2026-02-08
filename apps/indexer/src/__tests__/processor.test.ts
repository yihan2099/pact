import { describe, test, expect, beforeEach, spyOn } from 'bun:test';
import {
  createMockDatabase,
  createMockIpfsUtils,
  createMockCache,
  createMockSharedTypes,
  createMockRetry,
} from './helpers/mock-deps';

const mockDb = createMockDatabase();
const mockIpfs = createMockIpfsUtils();
const mockCache = createMockCache();
const mockTypes = createMockSharedTypes();
const mockRetry = createMockRetry();

mockDb.setupMock();
mockIpfs.setupMock();
mockCache.setupMock();
mockTypes.setupMock();
mockRetry.setupMock();

// We do NOT mock webhook-dispatch here. The real dispatch function runs
// fire-and-forget with database mocked (empty agent lists = no fetch calls).
// Webhook dispatch behaviour is tested in webhook-dispatch.test.ts.

const { processEvent } = await import('../processor');
import type { IndexerEvent } from '../listener';

function makeEvent(name: string, args: Record<string, unknown> = {}): IndexerEvent {
  return {
    name,
    chainId: 84532,
    blockNumber: 100n,
    transactionHash: '0xabc',
    logIndex: 0,
    args,
  };
}

const defaultArgs: Record<string, Record<string, unknown>> = {
  TaskCreated: {
    taskId: 1n,
    creator: '0xCreator',
    bountyAmount: 1000n,
    bountyToken: '0xToken',
    specificationCid: 'QmTest',
    deadline: 0n,
  },
  WorkSubmitted: {
    taskId: 1n,
    agent: '0xAgent',
    submissionCid: 'QmSub',
    submissionIndex: 0n,
  },
  WinnerSelected: {
    taskId: 1n,
    winner: '0xWinner',
    challengeDeadline: 1700000000n,
  },
  AllSubmissionsRejected: {
    taskId: 1n,
    creator: '0xCreator',
    reason: 'bad',
  },
  TaskCompleted: {
    taskId: 1n,
    winner: '0xWinner',
    bountyAmount: 5000n,
  },
  TaskRefunded: {
    taskId: 1n,
    creator: '0xCreator',
    refundAmount: 1000n,
  },
  TaskCancelled: {
    taskId: 1n,
    creator: '0xCreator',
    refundAmount: 1000n,
  },
  TaskDisputed: {
    taskId: 1n,
    disputer: '0xDisputer',
    disputeId: 1n,
  },
  AgentRegistered: {
    wallet: '0xAgent',
    agentId: 1n,
    agentURI: 'ipfs://QmTest',
  },
  AgentProfileUpdated: {
    wallet: '0xAgent',
    agentId: 1n,
    newURI: 'ipfs://QmTest',
  },
  DisputeCreated: {
    disputeId: 1n,
    taskId: 1n,
    disputer: '0xDisputer',
    stake: 500n,
    votingDeadline: 1700000000n,
  },
  VoteSubmitted: {
    disputeId: 1n,
    voter: '0xVoter',
    supportsDisputer: true,
    weight: 100n,
  },
  DisputeResolved: {
    disputeId: 1n,
    taskId: 1n,
    disputerWon: true,
    votesFor: 300n,
    votesAgainst: 100n,
  },
};

describe('processEvent', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockIpfs.resetAll();
    mockCache.resetAll();
    mockTypes.resetAll();
    mockRetry.resetAll();

    // Reset default implementations
    mockRetry.withRetryResult.mockImplementation((fn: () => Promise<unknown>) =>
      fn().then(
        (data) => ({ success: true, data, attempts: 1 }),
        (error: Error) => ({ success: false, error: error.message, attempts: 1 })
      )
    );
    mockDb.getTaskByChainId.mockImplementation(() =>
      Promise.resolve({
        id: 'db-task-1',
        status: 'open',
        chain_task_id: '1',
        creator_address: '0xcreator',
      })
    );
    mockDb.getDisputeByChainId.mockImplementation(() =>
      Promise.resolve({ id: 'db-dispute-1', disputer_address: '0xdisputer' })
    );
    mockDb.getSubmissionByTaskAndAgent.mockImplementation(() => Promise.resolve(null));
    mockIpfs.fetchTaskSpecification.mockImplementation(() =>
      Promise.resolve({ title: 'Test Task', description: 'desc', tags: [] })
    );
    mockIpfs.fetchJson.mockImplementation(() => Promise.resolve({ name: 'Agent', skills: [] }));
  });

  test('routes TaskCreated to handleTaskCreated', async () => {
    const event = makeEvent('TaskCreated', defaultArgs.TaskCreated);
    await processEvent(event);
    expect(mockDb.createTask).toHaveBeenCalledTimes(1);
  });

  test('routes WorkSubmitted to handleWorkSubmitted', async () => {
    const event = makeEvent('WorkSubmitted', defaultArgs.WorkSubmitted);
    await processEvent(event);
    expect(mockDb.createSubmission).toHaveBeenCalledTimes(1);
  });

  test('routes WinnerSelected to handleWinnerSelected', async () => {
    const event = makeEvent('WinnerSelected', defaultArgs.WinnerSelected);
    await processEvent(event);
    expect(mockDb.updateTask).toHaveBeenCalledTimes(1);
    const updates = mockDb.updateTask.mock.calls[0][1] as Record<string, unknown>;
    expect(updates.status).toBe('in_review');
  });

  test('routes AllSubmissionsRejected to handleAllSubmissionsRejected', async () => {
    const event = makeEvent('AllSubmissionsRejected', defaultArgs.AllSubmissionsRejected);
    await processEvent(event);
    expect(mockDb.updateTask).toHaveBeenCalledTimes(1);
    const updates = mockDb.updateTask.mock.calls[0][1] as Record<string, unknown>;
    expect(updates.status).toBe('in_review');
  });

  test('routes TaskCompleted to handleTaskCompleted', async () => {
    const event = makeEvent('TaskCompleted', defaultArgs.TaskCompleted);
    await processEvent(event);
    expect(mockDb.updateTask).toHaveBeenCalledTimes(1);
    const updates = mockDb.updateTask.mock.calls[0][1] as Record<string, unknown>;
    expect(updates.status).toBe('completed');
  });

  test('routes TaskRefunded to handleTaskRefunded', async () => {
    const event = makeEvent('TaskRefunded', defaultArgs.TaskRefunded);
    await processEvent(event);
    expect(mockDb.updateTask).toHaveBeenCalledTimes(1);
    const updates = mockDb.updateTask.mock.calls[0][1] as Record<string, unknown>;
    expect(updates.status).toBe('refunded');
  });

  test('routes TaskCancelled to handleTaskCancelled', async () => {
    const event = makeEvent('TaskCancelled', defaultArgs.TaskCancelled);
    await processEvent(event);
    expect(mockDb.updateTask).toHaveBeenCalledTimes(1);
    const updates = mockDb.updateTask.mock.calls[0][1] as Record<string, unknown>;
    expect(updates.status).toBe('cancelled');
  });

  test('routes TaskDisputed to handleTaskDisputed', async () => {
    mockDb.getTaskByChainId.mockImplementation(() =>
      Promise.resolve({ id: 'db-task-1', status: 'in_review', chain_task_id: '1' })
    );
    const event = makeEvent('TaskDisputed', defaultArgs.TaskDisputed);
    await processEvent(event);
    expect(mockDb.updateTask).toHaveBeenCalledTimes(1);
    const updates = mockDb.updateTask.mock.calls[0][1] as Record<string, unknown>;
    expect(updates.status).toBe('disputed');
  });

  test('routes AgentRegistered to handleAgentRegistered', async () => {
    const event = makeEvent('AgentRegistered', defaultArgs.AgentRegistered);
    await processEvent(event);
    expect(mockDb.upsertAgent).toHaveBeenCalledTimes(1);
  });

  test('routes AgentProfileUpdated to handleAgentProfileUpdated', async () => {
    const event = makeEvent('AgentProfileUpdated', defaultArgs.AgentProfileUpdated);
    await processEvent(event);
    expect(mockDb.updateAgent).toHaveBeenCalledTimes(1);
  });

  test('routes DisputeCreated to handleDisputeCreated', async () => {
    const event = makeEvent('DisputeCreated', defaultArgs.DisputeCreated);
    await processEvent(event);
    expect(mockDb.createDispute).toHaveBeenCalledTimes(1);
  });

  test('routes VoteSubmitted to handleVoteSubmitted', async () => {
    const event = makeEvent('VoteSubmitted', defaultArgs.VoteSubmitted);
    await processEvent(event);
    expect(mockDb.createDisputeVote).toHaveBeenCalledTimes(1);
  });

  test('routes DisputeResolved to handleDisputeResolved', async () => {
    const event = makeEvent('DisputeResolved', defaultArgs.DisputeResolved);
    await processEvent(event);
    expect(mockDb.updateDispute).toHaveBeenCalledTimes(1);
  });

  test('logs warning for unknown event type', async () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    await processEvent(makeEvent('UnknownEvent'));
    expect(warnSpy).toHaveBeenCalledWith('Unknown event type: UnknownEvent');
    warnSpy.mockRestore();
  });

  test('re-throws handler errors', async () => {
    mockDb.getTaskByChainId.mockImplementation(() => Promise.resolve(null));
    const event = makeEvent('TaskCompleted', defaultArgs.TaskCompleted);
    await expect(processEvent(event)).rejects.toThrow('not found in database');
  });
});
