import { describe, test, expect, beforeEach, mock } from 'bun:test';

const mockGetTaskHandler = mock(() =>
  Promise.resolve({
    id: 'task-1',
    creator: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
    status: 'open',
  })
);

mock.module('../../../services/task-service', () => ({
  getTaskHandler: mockGetTaskHandler,
}));

import { cancelTaskTool, cancelTaskSchema } from '../../../tools/task/cancel-task';

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
};

describe('cancel_task tool', () => {
  beforeEach(() => {
    mockGetTaskHandler.mockReset();
    mockGetTaskHandler.mockResolvedValue({
      id: 'task-1',
      creator: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
      status: 'open',
    });
  });

  test('should have correct tool metadata', () => {
    expect(cancelTaskTool.name).toBe('cancel_task');
    expect(cancelTaskTool.inputSchema.required).toContain('taskId');
  });

  test('should succeed when caller is creator and task is open', async () => {
    const result = await cancelTaskTool.handler({ taskId: 'task-1' }, context);

    expect(result.message).toContain('cancellation prepared');
    expect(result.taskId).toBe('task-1');
  });

  test('should throw when task not found', async () => {
    mockGetTaskHandler.mockResolvedValue(null as any);

    await expect(cancelTaskTool.handler({ taskId: 'missing' }, context)).rejects.toThrow(
      'Task not found'
    );
  });

  test('should throw when caller is not the creator', async () => {
    const otherContext = {
      callerAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    };

    await expect(cancelTaskTool.handler({ taskId: 'task-1' }, otherContext)).rejects.toThrow(
      'Only the task creator can cancel'
    );
  });

  test('should throw when task status is not open', async () => {
    mockGetTaskHandler.mockResolvedValue({
      id: 'task-1',
      creator: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd',
      status: 'in_review',
    });

    await expect(cancelTaskTool.handler({ taskId: 'task-1' }, context)).rejects.toThrow(
      'Cannot cancel task with status: in_review'
    );
  });

  test('should reject empty taskId in schema', () => {
    expect(() => cancelTaskSchema.parse({ taskId: '' })).toThrow();
  });
});
