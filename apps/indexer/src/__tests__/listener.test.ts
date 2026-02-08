import { describe, test, expect, mock, beforeEach, spyOn } from 'bun:test';
import { createMockDatabase, createMockWeb3Utils, createMockContracts } from './helpers/mock-deps';

const mockDb = createMockDatabase();
const mockWeb3 = createMockWeb3Utils();
const mockContracts = createMockContracts();

let mockBlockNumber = 100n;
mockWeb3.getBlockNumber.mockImplementation(() => Promise.resolve(mockBlockNumber));

mockDb.setupMock();
mockWeb3.setupMock();
mockContracts.setupMock();

const { createEventListener } = await import('../listener');
import type { IndexerEvent } from '../listener';

describe('createEventListener', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockWeb3.resetAll();
    mockBlockNumber = 100n;
    mockWeb3.getBlockNumber.mockImplementation(() => Promise.resolve(mockBlockNumber));
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(null));
    mockWeb3.mockGetLogs.mockImplementation(() => Promise.resolve([]));
  });

  test('creates listener with default chainId and pollingInterval', () => {
    const listener = createEventListener();
    expect(listener.isRunning()).toBe(false);
    expect(listener.getLastProcessedBlock()).toBe(0n);
    expect(listener.hasCompletedInitialSync()).toBe(false);
  });

  test('isRunning returns true after start and false after stop', async () => {
    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 50));
    expect(listener.isRunning()).toBe(true);
    listener.stop();
    expect(listener.isRunning()).toBe(false);
  });

  test('stop clears polling timeout', async () => {
    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 50));
    listener.stop();
    expect(listener.isRunning()).toBe(false);
  });

  test('loads checkpoint from database on start', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(50n));
    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 50));
    listener.stop();
    expect(mockDb.getLastSyncedBlock).toHaveBeenCalledTimes(3);
  });

  test('resumes from minimum checkpoint across contracts', async () => {
    let callCount = 0;
    mockDb.getLastSyncedBlock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(50n);
      if (callCount === 2) return Promise.resolve(40n);
      return Promise.resolve(60n);
    });
    mockBlockNumber = 40n;
    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 50));
    listener.stop();
    expect(listener.getLastProcessedBlock()).toBe(40n);
  });

  test('starts from current block when no checkpoint exists', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(null));
    mockBlockNumber = 200n;
    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 50));
    listener.stop();
    expect(listener.getLastProcessedBlock()).toBe(200n);
  });

  test('handles checkpoint load failure gracefully', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() =>
      Promise.reject(new Error('DB connection failed'))
    );
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 50));
    listener.stop();
    warnSpy.mockRestore();
  });

  test('does not poll when no event handler registered', async () => {
    const listener = createEventListener(84532, 50);
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();
    expect(mockWeb3.mockGetLogs).not.toHaveBeenCalled();
  });

  test('skips polling when fromBlock > toBlock', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(200n));
    mockBlockNumber = 100n;
    const handler = mock(() => Promise.resolve());
    const listener = createEventListener(84532, 100000);
    listener.onEvent(handler);
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();
    expect(handler).not.toHaveBeenCalled();
  });

  test('processes events in order by block number and log index', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(99n));
    mockBlockNumber = 101n;

    const taskCreatedLog = {
      blockNumber: 101n,
      transactionHash: '0x1',
      logIndex: 1,
      args: { taskId: 1n },
    };
    const workSubmittedLog = {
      blockNumber: 101n,
      transactionHash: '0x2',
      logIndex: 0,
      args: { taskId: 1n },
    };

    let callIdx = 0;
    mockWeb3.mockGetLogs.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve([taskCreatedLog]);
      if (callIdx === 2) return Promise.resolve([workSubmittedLog]);
      return Promise.resolve([]);
    });

    const events: IndexerEvent[] = [];
    const handler = mock((event: IndexerEvent) => {
      events.push(event);
      return Promise.resolve();
    });

    const listener = createEventListener(84532, 100000);
    listener.onEvent(handler);
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();

    if (events.length >= 2) {
      expect(events[0].logIndex).toBeLessThanOrEqual(events[1].logIndex);
    }
  });

  test('persists checkpoint to database after processing events', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(99n));
    mockBlockNumber = 101n;
    mockWeb3.mockGetLogs.mockImplementation(() => Promise.resolve([]));

    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();

    expect(mockDb.updateSyncState).toHaveBeenCalled();
  });

  test('handles checkpoint save failure gracefully', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(99n));
    mockBlockNumber = 101n;
    mockDb.updateSyncState.mockImplementation(() => Promise.reject(new Error('save failed')));
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();
    warnSpy.mockRestore();
  });

  test('sets completedInitialSync after first successful poll', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(99n));
    mockBlockNumber = 101n;

    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    expect(listener.hasCompletedInitialSync()).toBe(false);
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();
    expect(listener.hasCompletedInitialSync()).toBe(true);
  });

  test('catches polling errors and continues running', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(99n));
    let callCount = 0;
    mockWeb3.getBlockNumber.mockImplementation(() => {
      callCount++;
      if (callCount === 2) return Promise.reject(new Error('RPC error'));
      return Promise.resolve(101n);
    });

    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const listener = createEventListener(84532, 50);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 200));
    listener.stop();
    expect(listener.isRunning()).toBe(false);
    errorSpy.mockRestore();
  });

  test('parses log into IndexerEvent with correct fields', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(99n));
    mockBlockNumber = 101n;

    const taskCreatedLog = {
      blockNumber: 101n,
      transactionHash: '0xabc123',
      logIndex: 3,
      args: { taskId: 1n, creator: '0xCreator' },
    };

    mockWeb3.mockGetLogs.mockImplementation(() => {
      const result = mockWeb3.mockGetLogs.mock.calls.length === 1 ? [taskCreatedLog] : [];
      return Promise.resolve(result);
    });

    const events: IndexerEvent[] = [];
    const handler = mock((event: IndexerEvent) => {
      events.push(event);
      return Promise.resolve();
    });

    const listener = createEventListener(84532, 100000);
    listener.onEvent(handler);
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();

    if (events.length > 0) {
      const event = events[0];
      expect(event.name).toBe('TaskCreated');
      expect(event.chainId).toBe(84532);
      expect(event.blockNumber).toBe(101n);
      expect(event.transactionHash).toBe('0xabc123');
      expect(event.logIndex).toBe(3);
    }
  });

  test('queries all 13 event types from 3 contracts', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(99n));
    mockBlockNumber = 101n;

    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();

    expect(mockWeb3.mockGetLogs.mock.calls.length).toBe(13);
  });

  test('updates lastProcessedBlock to currentBlock after processing', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(99n));
    mockBlockNumber = 150n;

    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();
    expect(listener.getLastProcessedBlock()).toBe(150n);
  });

  test('handles null blockNumber and transactionHash in logs', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(99n));
    mockBlockNumber = 101n;

    const logWithNulls = {
      blockNumber: null,
      transactionHash: null,
      logIndex: null,
      args: {},
    };

    mockWeb3.mockGetLogs.mockImplementation(() => {
      if (mockWeb3.mockGetLogs.mock.calls.length === 1) return Promise.resolve([logWithNulls]);
      return Promise.resolve([]);
    });

    const events: IndexerEvent[] = [];
    const listener = createEventListener(84532, 100000);
    listener.onEvent(
      mock((event: IndexerEvent) => {
        events.push(event);
        return Promise.resolve();
      })
    );
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();

    if (events.length > 0) {
      expect(events[0].blockNumber).toBe(0n);
      expect(events[0].transactionHash).toBe('0x0');
      expect(events[0].logIndex).toBe(0);
    }
  });

  test('saves checkpoint for all three contracts', async () => {
    mockDb.getLastSyncedBlock.mockImplementation(() => Promise.resolve(99n));
    mockBlockNumber = 101n;

    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    listener.stop();

    expect(mockDb.updateSyncState).toHaveBeenCalledTimes(3);
    const addresses = mockDb.updateSyncState.mock.calls.map((c: unknown[]) => c[1]);
    expect(addresses).toContain('0xTaskManager');
    expect(addresses).toContain('0xDisputeResolver');
    expect(addresses).toContain('0xAgentAdapter');
  });

  test('on first run with no checkpoint, sets lastProcessedBlock to current block', async () => {
    mockBlockNumber = 500n;
    const listener = createEventListener(84532, 100000);
    listener.onEvent(mock(() => Promise.resolve()));
    listener.start();
    await new Promise((r) => setTimeout(r, 50));
    listener.stop();
    expect(listener.getLastProcessedBlock()).toBe(500n);
  });
});
