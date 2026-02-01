import { z } from 'zod';
import { createTaskHandler } from '../../services/task-service';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  deliverables: z.array(
    z.object({
      type: z.enum(['code', 'document', 'data', 'file', 'other']),
      description: z.string().min(1),
      format: z.string().optional(),
    })
  ).min(1),
  bountyAmount: z.string().regex(/^\d+\.?\d*$/),
  deadline: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const createTaskTool = {
  name: 'create_task',
  description: 'Create a new task with a bounty. Returns specification CID for on-chain creation.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Task title (max 200 characters)',
      },
      description: {
        type: 'string',
        description: 'Detailed task description',
      },
      deliverables: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['code', 'document', 'data', 'file', 'other'],
            },
            description: { type: 'string' },
            format: { type: 'string' },
          },
          required: ['type', 'description'],
        },
        description: 'Expected deliverables',
      },
      bountyAmount: {
        type: 'string',
        description: 'Bounty amount in ETH',
      },
      deadline: {
        type: 'string',
        description: 'Optional deadline (ISO 8601 format)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization',
      },
    },
    required: ['title', 'description', 'deliverables', 'bountyAmount'],
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}` }) => {
    const input = createTaskSchema.parse(args);
    const result = await createTaskHandler(input, context.callerAddress);

    return {
      message: 'Task specification created and uploaded to IPFS',
      specificationCid: result.specificationCid,
      nextStep: 'Call the TaskManager contract to create the task on-chain with this CID',
    };
  },
};
