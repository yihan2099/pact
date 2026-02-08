import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createMockQueryBuilder, setupSupabaseMock } from './helpers/mock-supabase';

// Set env vars BEFORE any imports
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-anon-key';
process.env.SUPABASE_SECRET_KEY = 'test-service-role-key';

// Setup mock BEFORE importing source modules
const supabaseMock = setupSupabaseMock();

// Now import real modules
const { resetSupabaseClient } = await import('../client');
const {
  getAgentsWithWebhooks,
  getAgentWebhookInfo,
  getAgentsWebhookInfoByAddresses,
  createWebhookDelivery,
  updateWebhookDelivery,
  getRetryableWebhookDeliveries,
} = await import('../queries/webhook-queries');

const mockAgentWebhook = {
  address: '0xagent1',
  webhook_url: 'https://example.com/webhook',
  webhook_secret: 'secret-123',
};

const mockDelivery = {
  id: 'del-1',
  agent_address: '0xagent1',
  event_name: 'task.created',
  payload: { taskId: 'task-1' } as Record<string, unknown>,
  status: 'pending',
  status_code: null as number | null,
  error_message: null as string | null,
  attempt: 1,
  max_attempts: 3,
  next_retry_at: null as string | null,
  created_at: '2025-01-01T00:00:00Z',
  delivered_at: null as string | null,
};

describe('webhook-queries', () => {
  beforeEach(() => {
    resetSupabaseClient();
    supabaseMock.reset();
    supabaseMock.setBuilder(createMockQueryBuilder([mockAgentWebhook]));
  });

  describe('getAgentsWithWebhooks', () => {
    test('queries agents with non-null webhook_url', async () => {
      const builder = createMockQueryBuilder([mockAgentWebhook]);
      supabaseMock.setBuilder(builder);
      const result = await getAgentsWithWebhooks();
      expect(result).toEqual([mockAgentWebhook]);
      expect(supabaseMock.mockFrom).toHaveBeenCalledWith('agents');
      expect(builder.not).toHaveBeenCalledWith('webhook_url', 'is', null);
      expect(builder.eq).toHaveBeenCalledWith('is_active', true);
    });

    test('filters out agents with null webhook_url from results', async () => {
      const mixedData = [
        mockAgentWebhook,
        { address: '0xagent2', webhook_url: null, webhook_secret: null },
      ];
      supabaseMock.setBuilder(createMockQueryBuilder(mixedData));
      const result = await getAgentsWithWebhooks();
      expect(result).toEqual([mockAgentWebhook]);
    });

    test('returns empty array when no agents have webhooks', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder([]));
      const result = await getAgentsWithWebhooks();
      expect(result).toEqual([]);
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(getAgentsWithWebhooks()).rejects.toThrow('Failed to get agents with webhooks');
    });
  });

  describe('getAgentWebhookInfo', () => {
    test('returns webhook info for agent', async () => {
      const builder = createMockQueryBuilder(mockAgentWebhook);
      supabaseMock.setBuilder(builder);
      const result = await getAgentWebhookInfo('0xAgent1');
      expect(result).toEqual(mockAgentWebhook);
      expect(builder.eq).toHaveBeenCalledWith('address', '0xagent1');
    });

    test('lowercases address', async () => {
      const builder = createMockQueryBuilder(mockAgentWebhook);
      supabaseMock.setBuilder(builder);
      await getAgentWebhookInfo('0xABCDEF');
      expect(builder.eq).toHaveBeenCalledWith('address', '0xabcdef');
    });

    test('returns null when not found (PGRST116)', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await getAgentWebhookInfo('0xnonexistent');
      expect(result).toBeNull();
    });

    test('returns null when webhook_url is null', async () => {
      supabaseMock.setBuilder(
        createMockQueryBuilder({ address: '0x1', webhook_url: null, webhook_secret: null })
      );
      const result = await getAgentWebhookInfo('0x1');
      expect(result).toBeNull();
    });

    test('throws on other errors', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { code: 'OTHER', message: 'DB error' }));
      await expect(getAgentWebhookInfo('0xagent')).rejects.toThrow(
        'Failed to get agent webhook info'
      );
    });
  });

  describe('getAgentsWebhookInfoByAddresses', () => {
    test('returns webhook info for multiple addresses', async () => {
      const builder = createMockQueryBuilder([mockAgentWebhook]);
      supabaseMock.setBuilder(builder);
      const result = await getAgentsWebhookInfoByAddresses(['0xAgent1']);
      expect(result).toEqual([mockAgentWebhook]);
      expect(builder.in).toHaveBeenCalledWith('address', ['0xagent1']);
    });

    test('returns empty array for empty input', async () => {
      const result = await getAgentsWebhookInfoByAddresses([]);
      expect(result).toEqual([]);
    });

    test('lowercases all addresses', async () => {
      const builder = createMockQueryBuilder([]);
      supabaseMock.setBuilder(builder);
      await getAgentsWebhookInfoByAddresses(['0xABC', '0xDEF']);
      expect(builder.in).toHaveBeenCalledWith('address', ['0xabc', '0xdef']);
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(getAgentsWebhookInfoByAddresses(['0x1'])).rejects.toThrow(
        'Failed to get agents webhook info'
      );
    });
  });

  describe('createWebhookDelivery', () => {
    test('creates and returns delivery record', async () => {
      const builder = createMockQueryBuilder(mockDelivery);
      supabaseMock.setBuilder(builder);
      const input = {
        agent_address: '0xagent1',
        event_type: 'task.created',
        payload: { taskId: 'task-1' },
      };
      const result = await createWebhookDelivery(input as any);
      expect(result).toEqual(mockDelivery);
      expect(supabaseMock.mockFrom).toHaveBeenCalledWith('webhook_deliveries');
      expect(builder.insert).toHaveBeenCalled();
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'Insert error' }));
      await expect(createWebhookDelivery({} as any)).rejects.toThrow(
        'Failed to create webhook delivery'
      );
    });
  });

  describe('updateWebhookDelivery', () => {
    test('updates delivery record', async () => {
      // updateWebhookDelivery doesn't return data, just checks for error
      const builder: any = {
        update: mock(() => builder),
        eq: mock(() => Promise.resolve({ error: null })),
      };
      supabaseMock.mockFrom.mockImplementation(() => builder);

      await updateWebhookDelivery('del-1', { status: 'delivered' as any });
      expect(supabaseMock.mockFrom).toHaveBeenCalledWith('webhook_deliveries');
    });

    test('throws on error', async () => {
      const builder: any = {
        update: mock(() => builder),
        eq: mock(() => Promise.resolve({ error: { message: 'Update error' } })),
      };
      supabaseMock.mockFrom.mockImplementation(() => builder);

      await expect(updateWebhookDelivery('del-1', { status: 'delivered' as any })).rejects.toThrow(
        'Failed to update webhook delivery'
      );
    });
  });

  describe('getRetryableWebhookDeliveries', () => {
    test('queries pending deliveries past retry time', async () => {
      const builder = createMockQueryBuilder([mockDelivery]);
      supabaseMock.setBuilder(builder);
      const result = await getRetryableWebhookDeliveries();
      expect(result).toEqual([mockDelivery]);
      expect(builder.eq).toHaveBeenCalledWith('status', 'pending');
      expect(builder.lte).toHaveBeenCalledWith('next_retry_at', expect.any(String));
      expect(builder.order).toHaveBeenCalledWith('next_retry_at', { ascending: true });
      expect(builder.limit).toHaveBeenCalledWith(50);
    });

    test('accepts custom limit', async () => {
      const builder = createMockQueryBuilder([]);
      supabaseMock.setBuilder(builder);
      await getRetryableWebhookDeliveries(10);
      expect(builder.limit).toHaveBeenCalledWith(10);
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }));
      await expect(getRetryableWebhookDeliveries()).rejects.toThrow(
        'Failed to get retryable webhook deliveries'
      );
    });
  });
});
