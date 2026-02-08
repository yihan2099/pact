import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createDatabaseMock } from '../../helpers/mock-deps';

const dbMock = createDatabaseMock();

mock.module('@clawboy/database', () => dbMock);

import { getMySubmissionsTool } from '../../../tools/agent/get-my-submissions';

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
};

describe('get_my_submissions tool', () => {
  beforeEach(() => {
    dbMock.getSubmissionsByAgent.mockReset();
    dbMock.getSubmissionsByAgent.mockResolvedValue({
      submissions: [
        {
          task_id: 'task-1',
          submission_cid: 'QmSub1',
          submitted_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          is_winner: false,
        },
      ] as any,
      total: 1,
    });
    dbMock.getTaskById.mockReset();
    dbMock.getTaskById.mockResolvedValue({
      title: 'Test Task',
      status: 'open',
      bounty_amount: '1000000',
    } as any);
  });

  test('should return enriched submissions', async () => {
    const result = await getMySubmissionsTool.handler({}, context);

    expect(result.submissions).toHaveLength(1);
    expect(result.submissions[0].taskTitle).toBe('Test Task');
    expect(result.submissions[0].submissionCid).toBe('QmSub1');
    expect(result.total).toBe(1);
  });

  test('should pass pagination parameters', async () => {
    await getMySubmissionsTool.handler({ limit: 10, offset: 5 }, context);

    expect(dbMock.getSubmissionsByAgent).toHaveBeenCalledWith(context.callerAddress, {
      limit: 10,
      offset: 5,
    });
  });

  test('should compute hasMore correctly', async () => {
    dbMock.getSubmissionsByAgent.mockResolvedValue({
      submissions: [
        {
          task_id: 'task-1',
          submission_cid: 'QmSub1',
          submitted_at: '',
          updated_at: '',
          is_winner: false,
        },
      ] as any,
      total: 10,
    });

    const result = await getMySubmissionsTool.handler({ limit: 5, offset: 0 }, context);

    expect(result.hasMore).toBe(true);
  });

  test('should handle empty submissions', async () => {
    dbMock.getSubmissionsByAgent.mockResolvedValue({ submissions: [], total: 0 });

    const result = await getMySubmissionsTool.handler({}, context);

    expect(result.submissions).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});
