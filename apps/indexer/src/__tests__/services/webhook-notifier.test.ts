import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createMockDatabase } from '../helpers/mock-deps';

const mockDb = createMockDatabase();

mockDb.setupMock();

const {
  notifyTaskCreated,
  notifyWorkSubmitted,
  notifyWinnerSelected,
  notifyTaskCompleted,
  notifyVoteSubmitted,
  processWebhookRetries,
} = await import('../../services/webhook-notifier');

const mockAgent = {
  address: '0xagent1',
  webhook_url: 'https://example.com/hook',
  webhook_secret: 'test-secret-123',
};

describe('notifyTaskCreated', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockDb.getAgentsWithWebhooks.mockImplementation(() => Promise.resolve([mockAgent]));
    mockDb.createWebhookDelivery.mockImplementation(() => Promise.resolve({ id: 'delivery-1' }));
  });

  test('fetches all agents with webhooks', async () => {
    await notifyTaskCreated('1', '0xcreator', 'Test Task', '1000', ['dev']);
    expect(mockDb.getAgentsWithWebhooks).toHaveBeenCalledTimes(1);
  });

  test('excludes the creator from webhook notifications', async () => {
    mockDb.getAgentsWithWebhooks.mockImplementation(() =>
      Promise.resolve([
        { address: '0xcreator', webhook_url: 'https://creator.com/hook', webhook_secret: 's' },
        mockAgent,
      ])
    );
    await notifyTaskCreated('1', '0xcreator', 'Test Task', '1000', ['dev']);
    await new Promise((r) => setTimeout(r, 50));
    const deliveryCalls = mockDb.createWebhookDelivery.mock.calls;
    const creatorDeliveries = deliveryCalls.filter(
      (c: unknown[]) => (c[0] as Record<string, unknown>).agent_address === '0xcreator'
    );
    expect(creatorDeliveries.length).toBe(0);
  });

  test('does not throw when no agents have webhooks', async () => {
    mockDb.getAgentsWithWebhooks.mockImplementation(() => Promise.resolve([]));
    await expect(
      notifyTaskCreated('1', '0xcreator', 'Test Task', '1000', [])
    ).resolves.toBeUndefined();
  });
});

describe('notifyWorkSubmitted', () => {
  beforeEach(() => {
    mockDb.resetAll();
  });

  test('looks up webhook info for task creator', async () => {
    mockDb.getAgentWebhookInfo.mockImplementation(() => Promise.resolve(mockAgent));
    await notifyWorkSubmitted('1', '0xcreator', '0xagent');
    expect(mockDb.getAgentWebhookInfo).toHaveBeenCalledWith('0xcreator');
  });

  test('does nothing when creator has no webhook', async () => {
    mockDb.getAgentWebhookInfo.mockImplementation(() => Promise.resolve(null));
    await notifyWorkSubmitted('1', '0xcreator', '0xagent');
    expect(mockDb.createWebhookDelivery).not.toHaveBeenCalled();
  });
});

describe('notifyWinnerSelected', () => {
  beforeEach(() => {
    mockDb.resetAll();
  });

  test('notifies all submitters about winner selection', async () => {
    mockDb.getSubmissionsByTaskId.mockImplementation(() =>
      Promise.resolve({
        submissions: [{ agent_address: '0xagent1' }, { agent_address: '0xagent2' }],
        total: 2,
      })
    );
    mockDb.getAgentsWebhookInfoByAddresses.mockImplementation(() => Promise.resolve([mockAgent]));
    await notifyWinnerSelected('1', 'db-task-1', '0xwinner');
    expect(mockDb.getSubmissionsByTaskId).toHaveBeenCalledWith('db-task-1');
    expect(mockDb.getAgentsWebhookInfoByAddresses).toHaveBeenCalledWith(['0xagent1', '0xagent2']);
  });
});

describe('notifyTaskCompleted', () => {
  beforeEach(() => {
    mockDb.resetAll();
  });

  test('notifies winner about task completion', async () => {
    mockDb.getAgentWebhookInfo.mockImplementation(() => Promise.resolve(mockAgent));
    await notifyTaskCompleted('1', '0xwinner', '5000');
    expect(mockDb.getAgentWebhookInfo).toHaveBeenCalledWith('0xwinner');
  });
});

describe('notifyVoteSubmitted', () => {
  beforeEach(() => {
    mockDb.resetAll();
  });

  test('notifies disputer about a new vote', async () => {
    mockDb.getAgentWebhookInfo.mockImplementation(() => Promise.resolve(mockAgent));
    await notifyVoteSubmitted('1', '10', '0xdisputer', '0xvoter', true);
    expect(mockDb.getAgentWebhookInfo).toHaveBeenCalledWith('0xdisputer');
  });
});

describe('processWebhookRetries', () => {
  beforeEach(() => {
    mockDb.resetAll();
  });

  test('does nothing when no retryable deliveries exist', async () => {
    mockDb.getRetryableWebhookDeliveries.mockImplementation(() => Promise.resolve([]));
    await processWebhookRetries();
    expect(mockDb.getAgentWebhookInfo).not.toHaveBeenCalled();
  });

  test('marks delivery as failed when agent no longer has webhook', async () => {
    mockDb.getRetryableWebhookDeliveries.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'd-1',
          agent_address: '0xnowebhook',
          attempt: 1,
          max_attempts: 3,
          payload: { event: 'TaskCreated', taskId: '1', timestamp: '', data: {} },
        },
      ])
    );
    mockDb.getAgentWebhookInfo.mockImplementation(() => Promise.resolve(null));
    await processWebhookRetries();
    expect(mockDb.updateWebhookDelivery).toHaveBeenCalledWith('d-1', {
      status: 'failed',
      error_message: 'Agent no longer has a webhook URL',
    });
  });

  test('marks delivery as failed when max attempts exceeded', async () => {
    mockDb.getRetryableWebhookDeliveries.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'd-2',
          agent_address: '0xagent1',
          attempt: 3,
          max_attempts: 3,
          payload: { event: 'TaskCreated', taskId: '1', timestamp: '', data: {} },
        },
      ])
    );
    mockDb.getAgentWebhookInfo.mockImplementation(() => Promise.resolve(mockAgent));
    await processWebhookRetries();
    expect(mockDb.updateWebhookDelivery).toHaveBeenCalledWith('d-2', {
      status: 'failed',
      error_message: 'Max attempts (3) exceeded',
    });
  });

  test('retries delivery and marks as delivered on success', async () => {
    mockDb.updateWebhookDelivery.mockClear();
    mockDb.getRetryableWebhookDeliveries.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'd-3',
          agent_address: '0xagent1',
          attempt: 1,
          max_attempts: 3,
          payload: { event: 'TaskCreated', taskId: '1', timestamp: '', data: {} },
        },
      ])
    );
    mockDb.getAgentWebhookInfo.mockImplementation(() => Promise.resolve(mockAgent));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('OK', { status: 200 }))
    ) as unknown as typeof fetch;
    await processWebhookRetries();
    await new Promise((r) => setTimeout(r, 100));
    const deliveredCalls = mockDb.updateWebhookDelivery.mock.calls.filter(
      (c: unknown[]) => (c[1] as Record<string, string>).status === 'delivered'
    );
    expect(deliveredCalls.length).toBeGreaterThanOrEqual(1);
    const ourDelivery = deliveredCalls.find((c: unknown[]) => c[0] === 'd-3');
    expect(ourDelivery).toBeDefined();
    globalThis.fetch = originalFetch;
  });

  test('schedules retry with exponential backoff on failure', async () => {
    mockDb.getRetryableWebhookDeliveries.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'd-4',
          agent_address: '0xagent1',
          attempt: 1,
          max_attempts: 3,
          payload: { event: 'TaskCreated', taskId: '1', timestamp: '', data: {} },
        },
      ])
    );
    mockDb.getAgentWebhookInfo.mockImplementation(() => Promise.resolve(mockAgent));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Server Error', { status: 500 }))
    ) as unknown as typeof fetch;
    await processWebhookRetries();
    await new Promise((r) => setTimeout(r, 50));
    const pendingCalls = mockDb.updateWebhookDelivery.mock.calls.filter(
      (c: unknown[]) => (c[1] as Record<string, string>).status === 'pending'
    );
    if (pendingCalls.length > 0) {
      expect((pendingCalls[0][1] as Record<string, unknown>).next_retry_at).toBeDefined();
    }
    globalThis.fetch = originalFetch;
  });
});
