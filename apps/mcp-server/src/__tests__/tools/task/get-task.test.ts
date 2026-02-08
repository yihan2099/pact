import { describe, test, expect, beforeEach, mock } from 'bun:test';

const mockGetTaskHandler = mock(() =>
  Promise.resolve({
    id: 'task-1',
    title: 'Test Task',
    description: 'A test task',
    status: 'open',
    bountyAmount: '1000000000000000000',
    bountyToken: '0xETH',
    bountyFormatted: '1.0 ETH',
    bountyTokenSymbol: 'ETH',
    creator: '0xCreator',
    deadline: null,
    tags: [],
    deliverables: [{ type: 'code', description: 'Source code' }],
    submissionCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
  })
);

mock.module('../../../services/task-service', () => ({
  getTaskHandler: mockGetTaskHandler,
}));

import { getTaskTool, getTaskSchema } from '../../../tools/task/get-task';

describe('get_task tool', () => {
  beforeEach(() => {
    mockGetTaskHandler.mockReset();
    mockGetTaskHandler.mockResolvedValue({
      id: 'task-1',
      title: 'Test Task',
      status: 'open',
      deliverables: [{ type: 'code', description: 'Source code' }],
    } as any);
  });

  test('should have correct tool metadata', () => {
    expect(getTaskTool.name).toBe('get_task');
    expect(getTaskTool.inputSchema.required).toContain('taskId');
  });

  test('should return task data for valid taskId', async () => {
    const result = await getTaskTool.handler({ taskId: 'task-1' });

    expect(mockGetTaskHandler).toHaveBeenCalledWith({ taskId: 'task-1' });
    expect(result.id).toBe('task-1');
  });

  test('should throw when task is not found', async () => {
    mockGetTaskHandler.mockResolvedValue(null as any);

    await expect(getTaskTool.handler({ taskId: 'nonexistent' })).rejects.toThrow(
      'Task not found: nonexistent'
    );
  });

  test('should reject empty taskId', () => {
    expect(() => getTaskSchema.parse({ taskId: '' })).toThrow();
  });

  test('should reject missing taskId', () => {
    expect(() => getTaskSchema.parse({})).toThrow();
  });
});
