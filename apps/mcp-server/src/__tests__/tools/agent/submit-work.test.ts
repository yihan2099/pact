import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createIpfsUtilsMock, createDatabaseMock } from '../../helpers/mock-deps';

const ipfsMock = createIpfsUtilsMock();
const dbMock = createDatabaseMock();

const mockGetTaskHandler = mock(() =>
  Promise.resolve({
    id: 'task-1',
    status: 'open',
    deadline: null,
  })
);

mock.module('../../../services/task-service', () => ({
  getTaskHandler: mockGetTaskHandler,
}));

mock.module('@clawboy/ipfs-utils', () => ipfsMock);
mock.module('@clawboy/database', () => dbMock);

import { submitWorkTool, submitWorkSchema } from '../../../tools/agent/submit-work';

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
};

const validInput = {
  taskId: 'task-1',
  summary: 'Completed the widget',
  deliverables: [{ type: 'code' as const, description: 'Source code' }],
};

describe('submit_work tool', () => {
  beforeEach(() => {
    mockGetTaskHandler.mockReset();
    mockGetTaskHandler.mockResolvedValue({ id: 'task-1', status: 'open', deadline: null });
    ipfsMock.uploadWorkSubmission.mockReset();
    ipfsMock.uploadWorkSubmission.mockResolvedValue({ cid: 'QmWorkCid123' });
    dbMock.getSubmissionByTaskAndAgent.mockReset();
    dbMock.getSubmissionByTaskAndAgent.mockResolvedValue(null);
    dbMock.createSubmission.mockReset();
    dbMock.updateSubmission.mockReset();
  });

  test('should have correct tool metadata', () => {
    expect(submitWorkTool.name).toBe('submit_work');
    expect(submitWorkTool.inputSchema.required).toContain('taskId');
    expect(submitWorkTool.inputSchema.required).toContain('summary');
    expect(submitWorkTool.inputSchema.required).toContain('deliverables');
  });

  test('should submit new work and upload to IPFS', async () => {
    const result = await submitWorkTool.handler(validInput, context);

    expect(ipfsMock.uploadWorkSubmission).toHaveBeenCalled();
    expect(dbMock.createSubmission).toHaveBeenCalled();
    expect(result.submissionCid).toBe('QmWorkCid123');
    expect(result.isUpdate).toBe(false);
    expect(result.message).toContain('submitted successfully');
  });

  test('should update existing submission', async () => {
    dbMock.getSubmissionByTaskAndAgent.mockResolvedValue({
      id: 'sub-1',
      task_id: 'task-1',
      agent_address: context.callerAddress,
      submission_cid: 'QmOldCid',
    } as any);

    const result = await submitWorkTool.handler(validInput, context);

    expect(dbMock.updateSubmission).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({
        submission_cid: 'QmWorkCid123',
      })
    );
    expect(result.isUpdate).toBe(true);
    expect(result.message).toContain('updated');
  });

  test('should throw when task not found', async () => {
    mockGetTaskHandler.mockResolvedValue(null as any);

    await expect(submitWorkTool.handler(validInput, context)).rejects.toThrow('Task not found');
  });

  test('should throw when task is not open', async () => {
    mockGetTaskHandler.mockResolvedValue({ id: 'task-1', status: 'completed', deadline: null });

    await expect(submitWorkTool.handler(validInput, context)).rejects.toThrow(
      'Cannot submit work for task with status: completed'
    );
  });

  test('should throw when deadline has passed', async () => {
    mockGetTaskHandler.mockResolvedValue({
      id: 'task-1',
      status: 'open',
      deadline: '2020-01-01T00:00:00Z' as any,
    });

    await expect(submitWorkTool.handler(validInput, context)).rejects.toThrow(
      'deadline has passed'
    );
  });

  test('should reject empty deliverables', () => {
    expect(() => submitWorkSchema.parse({ ...validInput, deliverables: [] })).toThrow();
  });

  test('should reject invalid CID format', () => {
    expect(() =>
      submitWorkSchema.parse({
        ...validInput,
        deliverables: [{ type: 'code', description: 'src', cid: 'invalid-cid' }],
      })
    ).toThrow();
  });

  test('should accept valid CID format', () => {
    const parsed = submitWorkSchema.parse({
      ...validInput,
      deliverables: [
        { type: 'code', description: 'src', cid: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG' },
      ],
    });
    expect(parsed.deliverables[0].cid).toBeDefined();
  });
});
