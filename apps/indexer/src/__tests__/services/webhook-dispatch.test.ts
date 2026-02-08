import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase } from '../helpers/mock-deps';

const mockDb = createMockDatabase();

mockDb.setupMock();

// Import the real webhook-dispatch (which imports the real webhook-notifier).
// Both use @clawboy/database which is mocked above.
const { dispatchWebhookNotifications } = await import('../../services/webhook-dispatch');
import type { IndexerEvent } from '../../listener';

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

describe('dispatchWebhookNotifications', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockDb.getTaskByChainId.mockImplementation(() =>
      Promise.resolve({
        id: 'db-task-1',
        title: 'My Task',
        tags: ['dev'],
        creator_address: '0xcreator',
      })
    );
    mockDb.getDisputeByChainId.mockImplementation(() =>
      Promise.resolve({
        id: 'db-dispute-1',
        task_id: 'db-task-1',
        disputer_address: '0xdisputer',
      })
    );
    // Return empty arrays so no real fetch calls happen
    mockDb.getAgentsWithWebhooks.mockImplementation(() => Promise.resolve([]));
    mockDb.getAgentWebhookInfo.mockImplementation(() => Promise.resolve(null));
    mockDb.getAgentsWebhookInfoByAddresses.mockImplementation(() => Promise.resolve([]));
    mockDb.getSubmissionsByTaskId.mockImplementation(() =>
      Promise.resolve({ submissions: [], total: 0 })
    );
  });

  test('dispatches TaskCreated webhook: looks up task and fetches agents', async () => {
    dispatchWebhookNotifications(
      makeEvent('TaskCreated', {
        taskId: 1n,
        creator: '0xCreator',
        bountyAmount: 1000n,
        specificationCid: 'QmTest',
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    // dispatch calls getTaskByChainId for title/tags, then notifyTaskCreated calls getAgentsWithWebhooks
    expect(mockDb.getTaskByChainId).toHaveBeenCalledWith('1', 84532);
    expect(mockDb.getAgentsWithWebhooks).toHaveBeenCalledTimes(1);
  });

  test('dispatches WorkSubmitted webhook: looks up task creator webhook', async () => {
    dispatchWebhookNotifications(makeEvent('WorkSubmitted', { taskId: 1n, agent: '0xAgent' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockDb.getTaskByChainId).toHaveBeenCalledWith('1', 84532);
    // notifyWorkSubmitted looks up creator's webhook info
    expect(mockDb.getAgentWebhookInfo).toHaveBeenCalledWith('0xcreator');
  });

  test('dispatches TaskCompleted webhook: looks up winner webhook', async () => {
    dispatchWebhookNotifications(
      makeEvent('TaskCompleted', {
        taskId: 1n,
        winner: '0xWinner',
        bountyAmount: 5000n,
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    // notifyTaskCompleted looks up winner's webhook info
    expect(mockDb.getAgentWebhookInfo).toHaveBeenCalledWith('0xwinner');
  });

  test('dispatches VoteSubmitted webhook with dispute lookup', async () => {
    dispatchWebhookNotifications(
      makeEvent('VoteSubmitted', {
        disputeId: 10n,
        voter: '0xVoter',
        supportsDisputer: true,
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockDb.getDisputeByChainId).toHaveBeenCalledWith('10');
    // notifyVoteSubmitted looks up disputer's webhook info
    expect(mockDb.getAgentWebhookInfo).toHaveBeenCalledWith('0xdisputer');
  });

  test('dispatches DisputeResolved webhook', async () => {
    dispatchWebhookNotifications(
      makeEvent('DisputeResolved', {
        disputeId: 10n,
        disputerWon: true,
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockDb.getDisputeByChainId).toHaveBeenCalledWith('10');
    // notifyDisputeResolved looks up disputer's webhook info
    expect(mockDb.getAgentsWebhookInfoByAddresses).toHaveBeenCalledWith(['0xdisputer']);
  });

  test('does not dispatch for events without webhook support', async () => {
    const noWebhookEvents = [
      'AllSubmissionsRejected',
      'TaskRefunded',
      'TaskCancelled',
      'TaskDisputed',
      'AgentRegistered',
      'AgentProfileUpdated',
    ];
    for (const eventName of noWebhookEvents) {
      dispatchWebhookNotifications(makeEvent(eventName, { taskId: 1n }));
    }
    await new Promise((r) => setTimeout(r, 50));
    // None of the notifier functions should have triggered DB lookups for webhooks
    expect(mockDb.getAgentsWithWebhooks).not.toHaveBeenCalled();
    expect(mockDb.getAgentWebhookInfo).not.toHaveBeenCalled();
  });

  test('does not throw on internal errors', async () => {
    mockDb.getTaskByChainId.mockImplementation(() => Promise.reject(new Error('DB error')));
    expect(() =>
      dispatchWebhookNotifications(
        makeEvent('TaskCreated', {
          taskId: 1n,
          creator: '0xCreator',
          bountyAmount: 1000n,
        })
      )
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));
  });

  test('handles unknown event types silently', () => {
    expect(() => dispatchWebhookNotifications(makeEvent('SomeRandomEvent'))).not.toThrow();
  });
});
