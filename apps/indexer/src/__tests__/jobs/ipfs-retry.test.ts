import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase, createMockIpfsUtils, createMockRetry } from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockIpfs = createMockIpfsUtils();
const mockRetry = createMockRetry();

mockDb.setupMock();
mockIpfs.setupMock();
mockRetry.setupMock();

const { runIpfsRetryJobs, startIpfsRetryJob } = await import('../../jobs/ipfs-retry');

describe('runIpfsRetryJobs', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockIpfs.resetAll();
    mockRetry.resetAll();
    mockRetry.withRetryResult.mockImplementation((fn: () => Promise<unknown>) =>
      fn().then(
        (data) => ({ success: true, data, attempts: 1 }),
        (error: Error) => ({ success: false, error: error.message, attempts: 1 })
      )
    );
    mockIpfs.isValidCid.mockImplementation(() => true);
    mockDb.getTasksWithFailedIpfs.mockImplementation(() => Promise.resolve([]));
    mockDb.getAgentsWithFailedIpfs.mockImplementation(() => Promise.resolve([]));
    mockIpfs.fetchTaskSpecification.mockImplementation(() =>
      Promise.resolve({ title: 'Fetched', description: 'desc', tags: ['tag1'] })
    );
    mockIpfs.fetchAgentProfile.mockImplementation(() =>
      Promise.resolve({ name: 'FetchedAgent', skills: ['skill1'] })
    );
  });

  test('does nothing when no tasks or agents have failed IPFS', async () => {
    await runIpfsRetryJobs();
    expect(mockDb.updateTask).not.toHaveBeenCalled();
    expect(mockDb.updateAgent).not.toHaveBeenCalled();
  });

  test('retries and updates task with fetched IPFS data', async () => {
    mockDb.getTasksWithFailedIpfs.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'task-1',
          chain_task_id: '1',
          specification_cid: 'QmValid',
        },
      ])
    );
    await runIpfsRetryJobs();
    expect(mockDb.updateTask).toHaveBeenCalledWith('task-1', {
      title: 'Fetched',
      description: 'desc',
      tags: ['tag1'],
      ipfs_fetch_failed: false,
    });
  });

  test('skips tasks with invalid CID format', async () => {
    mockIpfs.isValidCid.mockImplementation(() => false);
    mockDb.getTasksWithFailedIpfs.mockImplementation(() =>
      Promise.resolve([{ id: 'task-1', chain_task_id: '1', specification_cid: 'invalid' }])
    );
    await runIpfsRetryJobs();
    expect(mockIpfs.fetchTaskSpecification).not.toHaveBeenCalled();
    expect(mockDb.updateTask).not.toHaveBeenCalled();
  });

  test('retries and updates agent with fetched IPFS data', async () => {
    mockDb.getAgentsWithFailedIpfs.mockImplementation(() =>
      Promise.resolve([
        {
          address: '0xagent',
          profile_cid: 'QmAgentValid',
          name: 'OldName',
          skills: [],
        },
      ])
    );
    await runIpfsRetryJobs();
    expect(mockDb.updateAgent).toHaveBeenCalledWith('0xagent', {
      name: 'FetchedAgent',
      skills: ['skill1'],
      ipfs_fetch_failed: false,
    });
  });

  test('handles IPFS fetch failure for agent gracefully', async () => {
    mockDb.getAgentsWithFailedIpfs.mockImplementation(() =>
      Promise.resolve([
        {
          address: '0xagent',
          profile_cid: 'QmAgentFail',
          name: 'OldName',
          skills: [],
        },
      ])
    );
    mockIpfs.fetchAgentProfile.mockImplementation(() => Promise.reject(new Error('IPFS timeout')));
    await runIpfsRetryJobs();
    expect(mockDb.updateAgent).not.toHaveBeenCalled();
  });

  test('handles updateTask failure without crashing', async () => {
    mockDb.getTasksWithFailedIpfs.mockImplementation(() =>
      Promise.resolve([{ id: 'task-1', chain_task_id: '1', specification_cid: 'QmValid' }])
    );
    mockDb.updateTask.mockImplementation(() => Promise.reject(new Error('DB write failed')));
    await expect(runIpfsRetryJobs()).resolves.toBeUndefined();
  });
});

describe('startIpfsRetryJob', () => {
  test('returns cleanup function that stops the interval', () => {
    mockDb.getTasksWithFailedIpfs.mockImplementation(() => Promise.resolve([]));
    mockDb.getAgentsWithFailedIpfs.mockImplementation(() => Promise.resolve([]));
    const cleanup = startIpfsRetryJob(100000);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });
});
