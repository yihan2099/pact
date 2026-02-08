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
  isEventProcessed,
  markEventProcessed,
  addFailedEvent,
  getRetryableFailedEvents,
  getFailedEvents,
} = await import('../queries/event-processing-queries');

describe('event-processing-queries', () => {
  beforeEach(() => {
    resetSupabaseClient();
    supabaseMock.reset();
  });

  describe('isEventProcessed', () => {
    test('returns true via RPC when event is processed', async () => {
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: true, error: null }));
      const result = await isEventProcessed(84532, '0xhash', 0);
      expect(result).toBe(true);
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith('is_event_processed', {
        p_chain_id: 84532,
        p_tx_hash: '0xhash',
        p_log_index: 0,
      });
    });

    test('returns false via RPC when event is not processed', async () => {
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: false, error: null }));
      const result = await isEventProcessed(84532, '0xhash', 0);
      expect(result).toBe(false);
    });

    test('lowercases tx hash', async () => {
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: false, error: null }));
      await isEventProcessed(84532, '0xHASH', 0);
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith(
        'is_event_processed',
        expect.objectContaining({
          p_tx_hash: '0xhash',
        })
      );
    });

    test('falls back to direct query on RPC error', async () => {
      supabaseMock.setRpcHandler(() =>
        Promise.resolve({ data: null, error: { message: 'RPC not available' } })
      );
      const builder = createMockQueryBuilder({ id: 'ev-1' });
      supabaseMock.setBuilder(builder);
      const result = await isEventProcessed(84532, '0xhash', 0);
      expect(result).toBe(true);
      expect(supabaseMock.mockFrom).toHaveBeenCalledWith('processed_events');
    });

    test('returns false on fallback when not found (PGRST116)', async () => {
      supabaseMock.setRpcHandler(() =>
        Promise.resolve({ data: null, error: { message: 'RPC not available' } })
      );
      supabaseMock.setBuilder(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'not found' })
      );
      const result = await isEventProcessed(84532, '0xhash', 0);
      expect(result).toBe(false);
    });

    test('throws on fallback with other error', async () => {
      supabaseMock.setRpcHandler(() =>
        Promise.resolve({ data: null, error: { message: 'RPC not available' } })
      );
      supabaseMock.setBuilder(createMockQueryBuilder(null, { code: 'OTHER', message: 'DB error' }));
      await expect(isEventProcessed(84532, '0xhash', 0)).rejects.toThrow(
        'Failed to check if event is processed'
      );
    });
  });

  describe('markEventProcessed', () => {
    test('returns true via RPC when newly inserted', async () => {
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: true, error: null }));
      const event = {
        chainId: 84532,
        blockNumber: '100',
        txHash: '0xHASH',
        logIndex: 0,
        eventName: 'TaskCreated',
      };
      const result = await markEventProcessed(event);
      expect(result).toBe(true);
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith(
        'mark_event_processed',
        expect.objectContaining({
          p_tx_hash: '0xhash',
          p_event_name: 'TaskCreated',
        })
      );
    });

    test('falls back to direct insert on RPC error', async () => {
      supabaseMock.setRpcHandler(() =>
        Promise.resolve({ data: null, error: { message: 'RPC not available' } })
      );
      // Mock the insert path: from().insert() resolves with no error
      const insertBuilder: any = {
        insert: mock(() => Promise.resolve({ error: null })),
      };
      supabaseMock.mockFrom.mockImplementation(() => insertBuilder);

      const event = {
        chainId: 84532,
        blockNumber: '100',
        txHash: '0xhash',
        logIndex: 0,
        eventName: 'TaskCreated',
      };
      const result = await markEventProcessed(event);
      expect(result).toBe(true);
    });

    test('returns false on duplicate key (23505) in fallback', async () => {
      supabaseMock.setRpcHandler(() =>
        Promise.resolve({ data: null, error: { message: 'RPC not available' } })
      );
      const insertBuilder: any = {
        insert: mock(() => Promise.resolve({ error: { code: '23505', message: 'duplicate' } })),
      };
      supabaseMock.mockFrom.mockImplementation(() => insertBuilder);

      const event = {
        chainId: 84532,
        blockNumber: '100',
        txHash: '0xhash',
        logIndex: 0,
        eventName: 'TaskCreated',
      };
      const result = await markEventProcessed(event);
      expect(result).toBe(false);
    });
  });

  describe('getRetryableFailedEvents', () => {
    test('uses RPC first', async () => {
      const mockEvents = [{ id: 'ev-1', status: 'pending' }] as any[];
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: mockEvents, error: null }));
      const result = await getRetryableFailedEvents(10);
      expect(result).toEqual(mockEvents as any);
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith('get_retryable_failed_events', {
        p_limit: 10,
      });
    });

    test('falls back to direct query on RPC error', async () => {
      supabaseMock.setRpcHandler(() =>
        Promise.resolve({ data: null, error: { message: 'RPC error' } })
      );
      const mockEvents = [{ id: 'ev-1', status: 'pending' }] as any[];
      const builder = createMockQueryBuilder(mockEvents);
      supabaseMock.setBuilder(builder);
      await getRetryableFailedEvents();
      expect(supabaseMock.mockFrom).toHaveBeenCalledWith('failed_events');
      expect(builder.in).toHaveBeenCalledWith('status', ['pending', 'retrying']);
    });

    test('defaults limit to 10', async () => {
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: [], error: null }));
      await getRetryableFailedEvents();
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith('get_retryable_failed_events', {
        p_limit: 10,
      });
    });
  });

  describe('getFailedEvents', () => {
    test('returns failed events with pagination', async () => {
      const mockEvents = [{ id: 'ev-1' }] as any[];
      supabaseMock.setBuilder(createMockQueryBuilder(mockEvents, null, 1));
      const result = await getFailedEvents({});
      expect(result.events).toEqual(mockEvents as any);
      expect(result.total).toBe(1);
    });

    test('applies status filter', async () => {
      const builder = createMockQueryBuilder([], null, 0);
      supabaseMock.setBuilder(builder);
      await getFailedEvents({ status: 'pending' });
      expect(builder.eq).toHaveBeenCalledWith('status', 'pending');
    });

    test('applies pagination', async () => {
      const builder = createMockQueryBuilder([], null, 0);
      supabaseMock.setBuilder(builder);
      await getFailedEvents({ limit: 10, offset: 20 });
      expect(builder.range).toHaveBeenCalledWith(20, 29);
    });

    test('throws on error', async () => {
      supabaseMock.setBuilder(createMockQueryBuilder(null, { message: 'DB error' }, null));
      await expect(getFailedEvents({})).rejects.toThrow('Failed to get failed events');
    });
  });

  describe('addFailedEvent', () => {
    test('uses RPC to add failed event', async () => {
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: 'ev-1', error: null }));
      const event = {
        chainId: 84532,
        blockNumber: '100',
        txHash: '0xHASH',
        logIndex: 0,
        eventName: 'TaskCreated',
        eventData: { taskId: '1' },
        errorMessage: 'Processing failed',
      };
      const result = await addFailedEvent(event);
      expect(result).toBe('ev-1');
    });

    test('lowercases txHash', async () => {
      supabaseMock.setRpcHandler(() => Promise.resolve({ data: 'ev-1', error: null }));
      await addFailedEvent({
        chainId: 84532,
        blockNumber: '100',
        txHash: '0xABC',
        logIndex: 0,
        eventName: 'Test',
        eventData: {},
        errorMessage: 'error',
      });
      expect(supabaseMock.mockRpc).toHaveBeenCalledWith(
        'add_failed_event',
        expect.objectContaining({
          p_tx_hash: '0xabc',
        })
      );
    });
  });
});
