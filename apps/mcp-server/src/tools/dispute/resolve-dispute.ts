import { z } from 'zod';
import { getContractAddresses, DisputeResolverABI } from '@porternetwork/contracts';
import { getPublicClient } from '@porternetwork/web3-utils';
import { formatEther } from 'viem';

export const resolveDisputeSchema = z.object({
  disputeId: z.string().min(1),
});

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export const resolveDisputeTool = {
  name: 'resolve_dispute',
  description: 'Resolve a dispute after the voting period has ended. Can be called by anyone.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      disputeId: {
        type: 'string',
        description: 'The on-chain dispute ID to resolve',
      },
    },
    required: ['disputeId'],
  },
  handler: async (args: unknown) => {
    const input = resolveDisputeSchema.parse(args);
    const chainId = parseInt(process.env.CHAIN_ID || '84532', 10);
    const addresses = getContractAddresses(chainId);
    const publicClient = getPublicClient(chainId);

    // Fetch dispute to validate it can be resolved
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
      disputeStake: bigint;
      votingDeadline: bigint;
      status: number;
      disputerWon: boolean;
      votesForDisputer: bigint;
      votesAgainstDisputer: bigint;
    };

    if (dispute.id === 0n) {
      throw new Error(`Dispute not found: ${input.disputeId}`);
    }

    // DisputeStatus.Active = 0
    if (dispute.status !== 0) {
      throw new Error('Dispute is already resolved.');
    }

    // Check if voting deadline has passed
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < dispute.votingDeadline) {
      const timeRemaining = Number(dispute.votingDeadline - now);
      throw new Error(`Voting period has not ended yet. ${Math.ceil(timeRemaining / 3600)} hours remaining.`);
    }

    // Calculate expected outcome
    const totalVotes = dispute.votesForDisputer + dispute.votesAgainstDisputer;
    let expectedOutcome: string;
    let disputerWillWin: boolean;

    if (totalVotes === 0n) {
      expectedOutcome = 'Disputer loses (no votes cast - status quo preserved)';
      disputerWillWin = false;
    } else {
      const disputerPercent = Number((dispute.votesForDisputer * 100n) / totalVotes);
      if (disputerPercent >= 60) {
        expectedOutcome = `Disputer wins (${disputerPercent}% support, needs 60%)`;
        disputerWillWin = true;
      } else {
        expectedOutcome = `Disputer loses (${disputerPercent}% support, needs 60%)`;
        disputerWillWin = false;
      }
    }

    return {
      message: 'Ready to resolve dispute. Submit the transaction to finalize the outcome.',
      disputeId: input.disputeId,
      taskId: dispute.taskId.toString(),
      disputerAddress: dispute.disputer,
      disputeStake: formatEther(dispute.disputeStake),
      votesForDisputer: dispute.votesForDisputer.toString(),
      votesAgainstDisputer: dispute.votesAgainstDisputer.toString(),
      totalVotes: totalVotes.toString(),
      expectedOutcome,
      disputerWillWin,
      contractAddress: addresses.disputeResolver,
      contractFunction: 'resolveDispute(uint256 disputeId)',
      contractArgs: {
        disputeId: input.disputeId,
      },
      consequences: disputerWillWin
        ? [
            'Disputer will receive their stake back',
            'Task bounty will be redistributed based on dispute reason',
            'Disputer gains reputation',
          ]
        : [
            'Disputer\'s stake will be slashed (kept by protocol)',
            'Original task outcome stands',
            'Disputer loses 20 reputation',
          ],
      notes: [
        'Anyone can call resolveDispute after voting period ends',
        'The outcome is determined by weighted votes',
        'Voter reputation is updated based on whether they voted with the majority',
      ],
    };
  },
};
