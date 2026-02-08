import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createMockDatabase,
  createMockIpfsUtils,
  createMockCache,
  createMockRetry,
} from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockIpfs = createMockIpfsUtils();
const mockCache = createMockCache();
const mockRetry = createMockRetry();

mockDb.setupMock();
mockIpfs.setupMock();
mockCache.setupMock();
mockRetry.setupMock();

const { handleTaskCreated } = await import('../../handlers/task-created');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Partial<IndexerEvent['args']> = {}): IndexerEvent {
  return {
    name: 'TaskCreated',
    chainId: 84532,
    blockNumber: 100n,
    transactionHash: '0xabc',
    logIndex: 0,
    args: {
      taskId: 1n,
      creator: '0xCreator',
      bountyAmount: 1000n,
      bountyToken: '0xToken',
      specificationCid: 'QmTest123',
      deadline: 1700000000n,
      ...overrides,
    },
  };
}

describe('handleTaskCreated', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockIpfs.resetAll();
    mockCache.resetAll();
    mockRetry.resetAll();
    mockRetry.withRetryResult.mockImplementation((fn: () => Promise<unknown>) =>
      fn().then(
        (data) => ({ success: true, data, attempts: 1 }),
        (error: Error) => ({ success: false, error: error.message, attempts: 1 })
      )
    );
    mockIpfs.fetchTaskSpecification.mockImplementation(() =>
      Promise.resolve({ title: 'Test Task', description: 'A test', tags: ['dev'] })
    );
  });

  test('creates task with IPFS spec data', async () => {
    await handleTaskCreated(makeEvent());
    expect(mockDb.createTask).toHaveBeenCalledTimes(1);
    const arg = mockDb.createTask.mock.calls[0][0];
    expect(arg.title).toBe('Test Task');
    expect(arg.description).toBe('A test');
    expect(arg.tags).toEqual(['dev']);
    expect(arg.ipfs_fetch_failed).toBe(false);
  });

  test('maps event fields correctly to createTask params', async () => {
    await handleTaskCreated(makeEvent());
    const arg = mockDb.createTask.mock.calls[0][0];
    expect(arg.chain_id).toBe(84532);
    expect(arg.chain_task_id).toBe('1');
    expect(arg.creator_address).toBe('0xcreator');
    expect(arg.status).toBe('open');
    expect(arg.bounty_amount).toBe('1000');
    expect(arg.bounty_token).toBe('0xToken');
    expect(arg.specification_cid).toBe('QmTest123');
    expect(arg.created_at_block).toBe('100');
  });

  test('converts deadline to ISO string', async () => {
    await handleTaskCreated(makeEvent({ deadline: 1700000000n }));
    const arg = mockDb.createTask.mock.calls[0][0];
    expect(arg.deadline).toBe(new Date(1700000000 * 1000).toISOString());
  });

  test('sets deadline to null when deadline is 0', async () => {
    await handleTaskCreated(makeEvent({ deadline: 0n }));
    const arg = mockDb.createTask.mock.calls[0][0];
    expect(arg.deadline).toBeNull();
  });

  test('falls back to defaults when IPFS fetch fails', async () => {
    mockIpfs.fetchTaskSpecification.mockImplementation(() =>
      Promise.reject(new Error('IPFS timeout'))
    );
    await handleTaskCreated(makeEvent());
    const arg = mockDb.createTask.mock.calls[0][0];
    expect(arg.title).toBe('Untitled Task');
    expect(arg.description).toBe('');
    expect(arg.tags).toEqual([]);
    expect(arg.ipfs_fetch_failed).toBe(true);
  });

  test('invalidates task caches after creation', async () => {
    await handleTaskCreated(makeEvent());
    expect(mockCache.invalidateTaskCaches).toHaveBeenCalledTimes(1);
  });

  test('handles missing tags in IPFS spec', async () => {
    mockIpfs.fetchTaskSpecification.mockImplementation(() =>
      Promise.resolve({ title: 'No Tags', description: 'desc' })
    );
    await handleTaskCreated(makeEvent());
    const arg = mockDb.createTask.mock.calls[0][0];
    expect(arg.tags).toEqual([]);
  });

  test('lowercases creator address', async () => {
    await handleTaskCreated(makeEvent({ creator: '0xABCDEF' }));
    const arg = mockDb.createTask.mock.calls[0][0];
    expect(arg.creator_address).toBe('0xabcdef');
  });
});
