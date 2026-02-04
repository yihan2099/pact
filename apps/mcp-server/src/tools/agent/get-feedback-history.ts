import { z } from 'zod';
import { getAgentId, getAllFeedback, getFeedbackClients } from '@clawboy/web3-utils';

export const getFeedbackHistorySchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  limit: z.number().min(1).max(100).optional().default(50),
});

export type GetFeedbackHistoryInput = z.infer<typeof getFeedbackHistorySchema>;

export const getFeedbackHistoryTool = {
  name: 'get_feedback_history',
  description:
    'Get all feedback history for an agent from the ERC-8004 reputation registry. Returns individual feedback entries with tags, values, and client information.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      walletAddress: {
        type: 'string',
        description: 'Wallet address to query (defaults to your own if authenticated)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of feedback entries to return (default: 50, max: 100)',
      },
    },
  },
  handler: async (args: unknown, context: { callerAddress?: `0x${string}` }) => {
    const input = getFeedbackHistorySchema.parse(args);

    // Determine which wallet to query
    const targetAddress = (input.walletAddress || context.callerAddress) as `0x${string}`;

    if (!targetAddress) {
      throw new Error('walletAddress is required when not authenticated');
    }

    const chainId = parseInt(process.env.CHAIN_ID || '84532', 10);

    // Get agent ID
    const agentId = await getAgentId(targetAddress, chainId);

    if (agentId === 0n) {
      return {
        success: false,
        message: 'Agent not registered',
        walletAddress: targetAddress,
      };
    }

    // Get feedback clients
    const clients = await getFeedbackClients(agentId, chainId);

    // Get all feedback entries
    const feedbackEntries = await getAllFeedback(agentId, input.limit, chainId);

    // Format feedback entries for output
    const formattedFeedback = feedbackEntries
      .filter((entry) => !entry.isRevoked)
      .map((entry) => ({
        clientAddress: entry.clientAddress,
        feedbackIndex: entry.feedbackIndex.toString(),
        tag1: entry.tag1,
        tag2: entry.tag2,
        value: entry.value.toString(),
        valueDecimals: entry.valueDecimals,
        isRevoked: entry.isRevoked,
      }));

    return {
      success: true,
      walletAddress: targetAddress,
      agentId: agentId.toString(),
      totalClients: clients.length,
      feedbackCount: formattedFeedback.length,
      feedback: formattedFeedback,
    };
  },
};
