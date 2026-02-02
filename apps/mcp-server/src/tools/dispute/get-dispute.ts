import { z } from 'zod';
import { getDisputeByChainId, getDisputeVotes } from '@porternetwork/database';
import type { DisputeStatus } from '@porternetwork/shared-types';

export const getDisputeSchema = z.object({
  disputeId: z.string().min(1),
});

export type GetDisputeInput = z.infer<typeof getDisputeSchema>;

export const getDisputeTool = {
  name: 'get_dispute',
  description: 'Get detailed information about a specific dispute including votes',
  inputSchema: {
    type: 'object' as const,
    properties: {
      disputeId: {
        type: 'string',
        description: 'The on-chain dispute ID',
      },
    },
    required: ['disputeId'],
  },
  handler: async (args: unknown) => {
    const input = getDisputeSchema.parse(args);

    // Fetch dispute from database
    const dispute = await getDisputeByChainId(input.disputeId);

    if (!dispute) {
      throw new Error(`Dispute not found: ${input.disputeId}`);
    }

    // Fetch votes for this dispute
    const votes = await getDisputeVotes(dispute.id);

    // Calculate time remaining if active
    const now = new Date();
    const votingDeadline = new Date(dispute.voting_deadline);
    const isActive = dispute.status === 'active';
    const timeRemaining = isActive
      ? Math.max(0, votingDeadline.getTime() - now.getTime())
      : 0;

    return {
      dispute: {
        id: dispute.id,
        chainDisputeId: dispute.chain_dispute_id,
        taskId: dispute.task_id,
        disputerAddress: dispute.disputer_address,
        disputeStake: dispute.dispute_stake,
        votingDeadline: dispute.voting_deadline,
        status: dispute.status as DisputeStatus,
        disputerWon: dispute.disputer_won,
        votesForDisputer: dispute.votes_for_disputer,
        votesAgainstDisputer: dispute.votes_against_disputer,
        createdAt: dispute.created_at,
        resolvedAt: dispute.resolved_at,
      },
      votes: votes.map((v) => ({
        voterAddress: v.voter_address,
        supportsDisputer: v.supports_disputer,
        weight: v.weight,
        votedAt: v.voted_at,
      })),
      summary: {
        totalVotes: votes.length,
        totalWeightFor: dispute.votes_for_disputer,
        totalWeightAgainst: dispute.votes_against_disputer,
        isActive,
        timeRemainingMs: timeRemaining,
        canBeResolved: isActive && now >= votingDeadline,
      },
    };
  },
};
