import { z } from 'zod';
import { getContractAddresses, DisputeResolverABI, TaskManagerABI } from '@porternetwork/contracts';
import { getPublicClient, getAgentVoteWeight } from '@porternetwork/web3-utils';
import type { ServerContext } from '../../server';

export const submitVoteSchema = z.object({
  disputeId: z.string().min(1),
  supportsDisputer: z.boolean(),
});

export type SubmitVoteInput = z.infer<typeof submitVoteSchema>;

export const submitVoteTool = {
  name: 'submit_vote',
  description: 'Submit a vote on an active dispute. You cannot vote on disputes where you are the disputer or task creator.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      disputeId: {
        type: 'string',
        description: 'The on-chain dispute ID to vote on',
      },
      supportsDisputer: {
        type: 'boolean',
        description: 'True to vote in favor of the disputer, false to vote against',
      },
    },
    required: ['disputeId', 'supportsDisputer'],
  },
  handler: async (args: unknown, context: ServerContext) => {
    const input = submitVoteSchema.parse(args);
    const chainId = parseInt(process.env.CHAIN_ID || '84532', 10);
    const addresses = getContractAddresses(chainId);
    const publicClient = getPublicClient(chainId);

    // Fetch dispute to validate it's active
    const disputeData = await publicClient.readContract({
      address: addresses.disputeResolver,
      abi: DisputeResolverABI,
      functionName: 'getDispute',
      args: [BigInt(input.disputeId)],
    });

    const dispute = disputeData as unknown as {
      id: bigint;
      taskId: bigint;
      disputer: `0x${string}`;
      votingDeadline: bigint;
      status: number;
      votesForDisputer: bigint;
      votesAgainstDisputer: bigint;
    };

    if (dispute.id === 0n) {
      throw new Error(`Dispute not found: ${input.disputeId}`);
    }

    // DisputeStatus.Active = 0
    if (dispute.status !== 0) {
      throw new Error('Dispute is not active. Voting has ended.');
    }

    // Check if voting deadline has passed
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now > dispute.votingDeadline) {
      throw new Error('Voting period has ended for this dispute.');
    }

    // Check if caller is the disputer
    if (context.callerAddress.toLowerCase() === dispute.disputer.toLowerCase()) {
      throw new Error('Disputer cannot vote on their own dispute.');
    }

    // Fetch task to check if caller is creator
    const taskData = await publicClient.readContract({
      address: addresses.taskManager,
      abi: TaskManagerABI,
      functionName: 'getTask',
      args: [dispute.taskId],
    });

    const task = taskData as unknown as {
      creator: `0x${string}`;
    };

    if (context.callerAddress.toLowerCase() === task.creator.toLowerCase()) {
      throw new Error('Task creator cannot vote on disputes for their own task.');
    }

    // Check if already voted
    const hasVoted = await publicClient.readContract({
      address: addresses.disputeResolver,
      abi: DisputeResolverABI,
      functionName: 'hasVoted',
      args: [BigInt(input.disputeId), context.callerAddress],
    });

    if (hasVoted) {
      throw new Error('You have already voted on this dispute.');
    }

    // Get caller's vote weight
    const voteWeight = await getAgentVoteWeight(context.callerAddress, chainId);

    // Calculate time remaining
    const timeRemainingSeconds = Number(dispute.votingDeadline - now);

    return {
      message: 'Ready to submit vote. Submit the transaction to cast your vote.',
      disputeId: input.disputeId,
      taskId: dispute.taskId.toString(),
      supportsDisputer: input.supportsDisputer,
      votePosition: input.supportsDisputer ? 'FOR disputer' : 'AGAINST disputer',
      yourVoteWeight: voteWeight.toString(),
      currentVotesFor: dispute.votesForDisputer.toString(),
      currentVotesAgainst: dispute.votesAgainstDisputer.toString(),
      timeRemainingSeconds,
      timeRemainingHours: Math.round(timeRemainingSeconds / 360) / 10,
      callerAddress: context.callerAddress,
      contractAddress: addresses.disputeResolver,
      contractFunction: 'submitVote(uint256 disputeId, bool supportsDisputer)',
      contractArgs: {
        disputeId: input.disputeId,
        supportsDisputer: input.supportsDisputer,
      },
      notes: [
        `Your vote weight is ${voteWeight} (based on your reputation)`,
        'Vote weight is calculated as max(1, floor(log2(reputation + 1)))',
        'You receive +3 reputation if you vote with the winning side',
        'You receive -2 reputation if you vote with the losing side',
      ],
    };
  },
};
