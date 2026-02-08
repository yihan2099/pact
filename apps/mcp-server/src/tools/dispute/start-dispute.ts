import { z } from 'zod';
import { getContractAddresses, DisputeResolverABI, TaskManagerABI } from '@clawboy/contracts';
import { getPublicClient } from '@clawboy/web3-utils';
import { formatEther } from 'viem';
import type { ServerContext } from '../../server';
import { getChainId } from '../../config/chain';

export const startDisputeSchema = z.object({
  taskId: z.string().min(1),
});

export type StartDisputeInput = z.infer<typeof startDisputeSchema>;

export const startDisputeTool = {
  name: 'start_dispute',
  description:
    'Start a dispute on a task in review. Requires staking ETH. You must be a submitter on the task.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'The on-chain task ID to dispute',
      },
    },
    required: ['taskId'],
  },
  handler: async (args: unknown, context: ServerContext) => {
    const input = startDisputeSchema.parse(args);
    const chainId = getChainId();
    const addresses = getContractAddresses(chainId);
    const publicClient = getPublicClient(chainId);

    // Fetch task to validate it's in review and get bounty amount
    const taskData = await publicClient.readContract({
      address: addresses.taskManager,
      abi: TaskManagerABI,
      functionName: 'getTask',
      args: [BigInt(input.taskId)],
    });

    // viem returns a hybrid struct/tuple - cast through unknown to validate fields
    const r = taskData as unknown as readonly unknown[];
    if (!r || r.length < 4) {
      throw new Error('Unexpected contract response format for getTask');
    }
    const creator = r[1] as `0x${string}`;
    const status = r[2] as number;
    const bountyAmount = r[3] as bigint;
    if (typeof status !== 'number' || typeof bountyAmount !== 'bigint') {
      throw new Error('Unexpected field types in getTask response');
    }

    const task = { creator, bountyAmount, status };

    // TaskStatus.InReview = 1
    if (task.status !== 1) {
      throw new Error(
        'Task must be in review status to dispute. Current status does not allow disputes.'
      );
    }

    // Check if caller has submitted to this task
    const hasSubmitted = await publicClient.readContract({
      address: addresses.taskManager,
      abi: TaskManagerABI,
      functionName: 'hasSubmitted',
      args: [BigInt(input.taskId), context.callerAddress],
    });

    if (!hasSubmitted) {
      throw new Error('Only submitters on this task can start a dispute.');
    }

    // Check if dispute already exists
    const existingDisputeId = await publicClient.readContract({
      address: addresses.disputeResolver,
      abi: DisputeResolverABI,
      functionName: 'getDisputeByTask',
      args: [BigInt(input.taskId)],
    });

    if (existingDisputeId && (existingDisputeId as bigint) > 0n) {
      throw new Error(`A dispute already exists for this task (disputeId: ${existingDisputeId})`);
    }

    // Calculate required stake
    const minStake = (await publicClient.readContract({
      address: addresses.disputeResolver,
      abi: DisputeResolverABI,
      functionName: 'MIN_DISPUTE_STAKE',
    })) as bigint;

    const percentStake = task.bountyAmount / 100n; // 1%
    const requiredStake = percentStake > minStake ? percentStake : minStake;

    // Get voting period
    const votingPeriod = (await publicClient.readContract({
      address: addresses.disputeResolver,
      abi: DisputeResolverABI,
      functionName: 'votingPeriod',
    })) as bigint;

    return {
      message: 'Ready to start dispute. Submit the transaction with the required stake.',
      taskId: input.taskId,
      taskBounty: formatEther(task.bountyAmount),
      requiredStake: formatEther(requiredStake),
      requiredStakeWei: requiredStake.toString(),
      votingPeriodSeconds: Number(votingPeriod),
      votingPeriodHours: Number(votingPeriod) / 3600,
      callerAddress: context.callerAddress,
      contractAddress: addresses.disputeResolver,
      contractFunction: 'startDispute(uint256 taskId)',
      contractArgs: {
        taskId: input.taskId,
      },
      txValue: requiredStake.toString(),
      notes: [
        'Stake will be returned if you win the dispute',
        'Stake will be slashed if you lose the dispute',
        `Voting period is ${Number(votingPeriod) / 3600} hours`,
        'You need 60% of weighted votes to win',
      ],
    };
  },
};
