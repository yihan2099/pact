import { z } from 'zod';
import { prepareSubmitWorkHandler } from '../../services/claim-service';
import { getTaskHandler } from '../../services/task-service';

export const submitWorkSchema = z.object({
  taskId: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().optional(),
  deliverables: z.array(
    z.object({
      type: z.enum(['code', 'document', 'data', 'file', 'other']),
      description: z.string().min(1),
      cid: z.string().optional(),
      url: z.string().url().optional(),
    })
  ).min(1),
  verifierNotes: z.string().optional(),
});

export type SubmitWorkInput = z.infer<typeof submitWorkSchema>;

export const submitWorkTool = {
  name: 'submit_work',
  description: 'Submit completed work for a claimed task. Uploads submission to IPFS.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID',
      },
      summary: {
        type: 'string',
        description: 'Summary of work completed',
      },
      description: {
        type: 'string',
        description: 'Detailed description of the work',
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
            cid: { type: 'string' },
            url: { type: 'string' },
          },
          required: ['type', 'description'],
        },
        description: 'Submitted deliverables with CIDs or URLs',
      },
      verifierNotes: {
        type: 'string',
        description: 'Notes for the verifier',
      },
    },
    required: ['taskId', 'summary', 'deliverables'],
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}` }) => {
    const input = submitWorkSchema.parse(args);

    // Verify task exists and is claimed by caller
    const task = await getTaskHandler({ taskId: input.taskId });
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    if (task.claimedBy?.toLowerCase() !== context.callerAddress.toLowerCase()) {
      throw new Error('Only the agent who claimed this task can submit work');
    }

    if (task.status !== 'claimed') {
      throw new Error(`Cannot submit work for task with status: ${task.status}`);
    }

    const result = await prepareSubmitWorkHandler(input, context.callerAddress);

    return {
      message: 'Work submission uploaded to IPFS',
      taskId: result.taskId,
      submissionCid: result.submissionCid,
      nextStep: 'Call the TaskManager contract to submit work on-chain with this CID',
    };
  },
};
