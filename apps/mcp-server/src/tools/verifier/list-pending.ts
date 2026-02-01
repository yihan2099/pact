import { z } from 'zod';
import { getPendingVerificationTasks } from '@porternetwork/database';

export const listPendingSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export type ListPendingInput = z.infer<typeof listPendingSchema>;

export const listPendingTool = {
  name: 'list_pending_verifications',
  description: 'List tasks awaiting verification. Only available for Elite tier agents.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Number of results to return (default: 20)',
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination',
      },
    },
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}`; isVerifier: boolean }) => {
    if (!context.isVerifier) {
      throw new Error('Only Elite tier agents can access verifications');
    }

    const input = listPendingSchema.parse(args);
    const { tasks, total } = await getPendingVerificationTasks(input.limit, input.offset);

    const verifications = tasks.map((task) => ({
      taskId: task.id,
      title: task.title,
      agentAddress: task.claimed_by,
      submissionCid: task.submission_cid,
      submittedAt: task.submitted_at,
      deadline: task.deadline,
      bountyAmount: task.bounty_amount,
      bountyToken: task.bounty_token,
    }));

    return {
      verifications,
      total,
      hasMore: input.offset + verifications.length < total,
    };
  },
};
