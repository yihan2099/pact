import { z } from 'zod';
import { getAgentId, getAgentReputationSummary, getFeedbackSummary } from '@clawboy/web3-utils';
import { getChainId } from '../../config/chain';

export const getReputationSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  tag1: z.string().optional(),
  tag2: z.string().optional(),
});

export type GetReputationInput = z.infer<typeof getReputationSchema>;

export const getReputationTool = {
  name: 'get_reputation',
  description:
    'Get reputation summary for an agent from the ERC-8004 reputation registry. Returns task wins, dispute wins/losses, and total reputation. Optionally filter by feedback tags.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      walletAddress: {
        type: 'string',
        description: 'Wallet address to query (defaults to your own if authenticated)',
      },
      tag1: {
        type: 'string',
        description: 'Primary tag to filter by (e.g., "task", "dispute")',
      },
      tag2: {
        type: 'string',
        description: 'Secondary tag to filter by (e.g., "win", "loss")',
      },
    },
  },
  handler: async (args: unknown, context: { callerAddress?: `0x${string}` }) => {
    const input = getReputationSchema.parse(args);

    // Determine which wallet to query
    const targetAddress = (input.walletAddress || context.callerAddress) as `0x${string}`;

    if (!targetAddress) {
      throw new Error('walletAddress is required when not authenticated');
    }

    const chainId = getChainId();

    // Get agent ID
    const agentId = await getAgentId(targetAddress, chainId);

    if (agentId === 0n) {
      return {
        success: false,
        message: 'Agent not registered',
        walletAddress: targetAddress,
      };
    }

    // Get overall reputation summary from adapter
    const summary = await getAgentReputationSummary(targetAddress, chainId);

    // Build result
    const result: Record<string, unknown> = {
      success: true,
      walletAddress: targetAddress,
      agentId: agentId.toString(),
      reputation: {
        taskWins: summary.taskWins.toString(),
        disputeWins: summary.disputeWins.toString(),
        disputeLosses: summary.disputeLosses.toString(),
        totalReputation: summary.totalReputation.toString(),
      },
    };

    // If tags are specified, get filtered summary
    if (input.tag1 || input.tag2) {
      const filteredSummary = await getFeedbackSummary(
        agentId,
        input.tag1 || '',
        input.tag2 || '',
        [],
        chainId
      );

      result.filteredFeedback = {
        tag1: input.tag1 || '*',
        tag2: input.tag2 || '*',
        count: filteredSummary.count.toString(),
        summaryValue: filteredSummary.summaryValue.toString(),
        summaryValueDecimals: filteredSummary.summaryValueDecimals,
      };
    }

    return result;
  },
};
