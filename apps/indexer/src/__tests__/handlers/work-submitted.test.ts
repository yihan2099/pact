import { describe, test, expect, beforeEach } from 'bun:test';
import { createMockDatabase, createMockCache } from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockCache = createMockCache();

mockDb.setupMock();
mockCache.setupMock();

const { handleWorkSubmitted } = await import('../../handlers/work-submitted');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'WorkSubmitted',
    chainId: 84532,
    blockNumber: 200n,
    transactionHash: '0xdef',
    logIndex: 1,
    args: {
      taskId: 1n,
      agent: '0xAgent',
      submissionCid: 'QmSubmission',
      submissionIndex: 0n,
      ...overrides,
    },
  };
}

describe('handleWorkSubmitted', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockCache.resetAll();
    mockDb.getTaskByChainId.mockImplementation(() =>
      Promise.resolve({ id: 'db-task-1', creator_address: '0xcreator' })
    );
    mockDb.getSubmissionByTaskAndAgent.mockImplementation(() => Promise.resolve(null));
  });

  test('creates new submission when agent has not submitted before', async () => {
    await handleWorkSubmitted(makeEvent());
    expect(mockDb.createSubmission).toHaveBeenCalledTimes(1);
    const arg = mockDb.createSubmission.mock.calls[0][0];
    expect(arg.task_id).toBe('db-task-1');
    expect(arg.agent_address).toBe('0xagent');
    expect(arg.submission_cid).toBe('QmSubmission');
    expect(arg.submission_index).toBe(0);
  });

  test('updates existing submission when agent already submitted', async () => {
    mockDb.getSubmissionByTaskAndAgent.mockImplementation(() =>
      Promise.resolve({ id: 'existing-sub' })
    );
    await handleWorkSubmitted(makeEvent());
    expect(mockDb.updateSubmission).toHaveBeenCalledTimes(1);
    expect(mockDb.createSubmission).not.toHaveBeenCalled();
    expect(mockDb.updateSubmission.mock.calls[0][0]).toBe('existing-sub');
    expect(mockDb.updateSubmission.mock.calls[0][1].submission_cid).toBe('QmSubmission');
  });

  test('throws when task is not found in database', async () => {
    mockDb.getTaskByChainId.mockImplementation(() => Promise.resolve(null));
    await expect(handleWorkSubmitted(makeEvent())).rejects.toThrow('not found in database');
  });

  test('invalidates submission and task caches', async () => {
    await handleWorkSubmitted(makeEvent());
    expect(mockCache.invalidateSubmissionCaches).toHaveBeenCalledWith('db-task-1', '0xagent');
    expect(mockCache.invalidateTaskCaches).toHaveBeenCalledWith('db-task-1');
  });

  test('lowercases agent address', async () => {
    await handleWorkSubmitted(makeEvent({ agent: '0xABCDEF' }));
    const arg = mockDb.createSubmission.mock.calls[0][0];
    expect(arg.agent_address).toBe('0xabcdef');
  });

  test('looks up task with chain ID', async () => {
    await handleWorkSubmitted(makeEvent());
    expect(mockDb.getTaskByChainId).toHaveBeenCalledWith('1', 84532);
  });
});
