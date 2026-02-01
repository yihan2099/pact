import { z } from 'zod';
import { getAgentClaimsHandler } from '../../services/claim-service';

export const getMyClaimsSchema = z.object({
  status: z.enum(['active', 'submitted', 'approved', 'rejected']).optional(),
  limit: z.number().min(1).max(100).default(20),
});

export type GetMyClaimsInput = z.infer<typeof getMyClaimsSchema>;

export const getMyClaimsTool = {
  name: 'get_my_claims',
  description: 'Get your claimed tasks and their current status',
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'submitted', 'approved', 'rejected'],
        description: 'Filter by claim status',
      },
      limit: {
        type: 'number',
        description: 'Number of results to return (default: 20)',
      },
    },
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}` }) => {
    const input = getMyClaimsSchema.parse(args);
    const result = await getAgentClaimsHandler(
      context.callerAddress,
      input.status,
      input.limit
    );

    return {
      claims: result.claims,
      total: result.total,
      agentAddress: context.callerAddress,
    };
  },
};
