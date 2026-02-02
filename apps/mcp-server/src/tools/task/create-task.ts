import { z } from 'zod';
import { createTaskHandler } from '../../services/task-service';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(50000), // SECURITY: Limit description length
  deliverables: z.array(
    z.object({
      type: z.enum(['code', 'document', 'data', 'file', 'other']),
      description: z.string().min(1).max(2000), // SECURITY: Limit deliverable description
      format: z.string().max(100).optional(),
    })
  ).min(1).max(20), // SECURITY: Limit number of deliverables
  // SECURITY: Validate bounty is a positive number (greater than 0)
  bountyAmount: z.string()
    .regex(/^\d+\.?\d*$/, 'Bounty must be a valid number')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Bounty amount must be greater than 0'),
  deadline: z.string().datetime().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(), // SECURITY: Limit tags
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
