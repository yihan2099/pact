import { describe, test, expect, beforeEach, mock } from 'bun:test';

const mockListTasksHandler = mock(() =>
  Promise.resolve({
    tasks: [
      {
        id: 'task-1',
        title: 'Test Task',
        bountyAmount: '1000000',
        bountyToken: '0xUSDC',
        bountyFormatted: '1.0 USDC',
        bountyTokenSymbol: 'USDC',
        status: 'open',
        creatorAddress: '0xCreator',
        deadline: null,
        tags: ['dev'],
        createdAt: '2024-01-01T00:00:00Z',
        submissionCount: 0,
        winnerAddress: null,
        challengeDeadline: null,
      },
    ],
    total: 1,
    hasMore: false,
  })
);

mock.module('../../../services/task-service', () => ({
  listTasksHandler: mockListTasksHandler,
}));

import { listTasksTool, listTasksSchema } from '../../../tools/task/list-tasks';

describe('list_tasks tool', () => {
  beforeEach(() => {
    mockListTasksHandler.mockReset();
    mockListTasksHandler.mockResolvedValue({
      tasks: [{ id: 'task-1', title: 'Test Task' } as any],
      total: 1,
      hasMore: false,
    });
  });

  test('should have correct tool metadata', () => {
    expect(listTasksTool.name).toBe('list_tasks');
    expect(listTasksTool.inputSchema.type).toBe('object');
  });

  test('should call handler with default values for empty input', async () => {
    await listTasksTool.handler({});

    expect(mockListTasksHandler).toHaveBeenCalled();
    const calledWith = (mockListTasksHandler.mock.calls[0] as any[])[0];
    expect(calledWith.limit).toBe(20);
    expect(calledWith.offset).toBe(0);
    expect(calledWith.sortBy).toBe('createdAt');
    expect(calledWith.sortOrder).toBe('desc');
  });

  test('should pass status filter through', async () => {
    await listTasksTool.handler({ status: 'open' });

    const calledWith = (mockListTasksHandler.mock.calls[0] as any[])[0];
    expect(calledWith.status).toBe('open');
  });

  test('should pass tags filter through', async () => {
    await listTasksTool.handler({ tags: ['dev', 'solidity'] });

    const calledWith = (mockListTasksHandler.mock.calls[0] as any[])[0];
    expect(calledWith.tags).toEqual(['dev', 'solidity']);
  });

  test('should include pagination in response', async () => {
    const result = await listTasksTool.handler({ limit: 10, offset: 5 });

    expect(result.limit).toBe(10);
    expect(result.offset).toBe(5);
  });

  test('should reject limit above 100', () => {
    expect(() => listTasksSchema.parse({ limit: 101 })).toThrow();
  });
});
