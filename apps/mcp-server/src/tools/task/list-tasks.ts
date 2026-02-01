import { z } from 'zod';
import { listTasksHandler } from '../../services/task-service';

export const listTasksSchema = z.object({
  status: z.enum(['open', 'claimed', 'submitted', 'completed']).optional(),
  tags: z.array(z.string()).optional(),
  minBounty: z.string().optional(),
  maxBounty: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['bounty', 'createdAt', 'deadline']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListTasksInput = z.infer<typeof listTasksSchema>;

export const listTasksTool = {
  name: 'list_tasks',
  description: 'List available tasks with optional filters for status, tags, and bounty range',
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        enum: ['open', 'claimed', 'submitted', 'completed'],
        description: 'Filter by task status',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags',
      },
      minBounty: {
        type: 'string',
        description: 'Minimum bounty amount in ETH',
      },
      maxBounty: {
        type: 'string',
        description: 'Maximum bounty amount in ETH',
      },
      limit: {
        type: 'number',
        description: 'Number of results to return (default: 20, max: 100)',
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination',
      },
      sortBy: {
        type: 'string',
        enum: ['bounty', 'createdAt', 'deadline'],
        description: 'Field to sort by',
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order',
      },
    },
  },
  handler: async (args: unknown) => {
    const input = listTasksSchema.parse(args);
    const result = await listTasksHandler(input);
    return result;
  },
};
