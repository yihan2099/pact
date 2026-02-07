import { listTasks, getTaskById } from '@clawboy/database';
import { fetchTaskSpecification, uploadTaskSpecification } from '@clawboy/ipfs-utils';
import { formatTokenAmount, parseTokenAmount } from '@clawboy/web3-utils';
import { getTokenByAddress, resolveToken } from '@clawboy/contracts';
import type { ListTasksInput, CreateTaskInput, GetTaskInput } from '@clawboy/shared-types';
import type { TaskListItem, GetTaskResponse } from '@clawboy/shared-types';
import { getChainId } from '../config/chain';

/** Extended task list item with formatted bounty */
export interface TaskListItemWithFormatted extends TaskListItem {
  bountyFormatted: string;
  bountyTokenSymbol: string;
}

/**
 * List tasks with filters
 */
export async function listTasksHandler(
  input: ListTasksInput
): Promise<{ tasks: TaskListItemWithFormatted[]; total: number; hasMore: boolean }> {
  const chainId = getChainId();

  // Map sortBy field names
  let sortBy: 'created_at' | 'deadline' | 'bounty_amount' | undefined;
  if (input.sortBy === 'bounty') {
    sortBy = 'bounty_amount';
  } else if (input.sortBy === 'createdAt') {
    sortBy = 'created_at';
  } else if (input.sortBy === 'deadline') {
    sortBy = 'deadline';
  }

  // Resolve bountyToken filter to address
  let bountyTokenAddress: string | undefined;
  if (input.bountyToken) {
    const tokenConfig = resolveToken(chainId, input.bountyToken);
    if (!tokenConfig) {
      throw new Error(
        `Invalid bountyToken filter: "${input.bountyToken}". Use a symbol (ETH, USDC) or address.`
      );
    }
    bountyTokenAddress = tokenConfig.address;
  }

  // Convert bounty filter amounts to wei using token decimals if specified
  // Otherwise default to 18 decimals (ETH)
  let minBountyWei: string | undefined;
  let maxBountyWei: string | undefined;

  // Determine decimals for bounty filter conversion
  const filterDecimals = bountyTokenAddress
    ? (getTokenByAddress(chainId, bountyTokenAddress)?.decimals ?? 18)
    : 18; // Default to ETH decimals

  if (input.minBounty) {
    try {
      minBountyWei = parseTokenAmount(input.minBounty, filterDecimals).toString();
    } catch {
      throw new Error(
        `Invalid minBounty value: "${input.minBounty}". Expected a valid number (e.g., "0.5", "100")`
      );
    }
  }

  if (input.maxBounty) {
    try {
      maxBountyWei = parseTokenAmount(input.maxBounty, filterDecimals).toString();
    } catch {
      throw new Error(
        `Invalid maxBounty value: "${input.maxBounty}". Expected a valid number (e.g., "0.5", "100")`
      );
    }
  }

  const { tasks, total } = await listTasks({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: input.status as any,
    tags: input.tags,
    minBounty: minBountyWei,
    maxBounty: maxBountyWei,
    bountyToken: bountyTokenAddress,
    limit: input.limit || 20,
    offset: input.offset || 0,
    sortBy,
    sortOrder: input.sortOrder,
  });

  const taskItems: TaskListItemWithFormatted[] = tasks.map((task) => {
    // Get token info for formatting
    const tokenConfig = getTokenByAddress(chainId, task.bounty_token);
    const decimals = tokenConfig?.decimals ?? 18;
    const symbol = tokenConfig?.symbol ?? 'ETH';
    const formatted = formatTokenAmount(BigInt(task.bounty_amount), decimals) + ' ' + symbol;

    return {
      id: task.id,
      title: task.title,
      bountyAmount: task.bounty_amount,
      bountyToken: task.bounty_token as `0x${string}`,
      bountyFormatted: formatted,
      bountyTokenSymbol: symbol,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: task.status as any,
      creatorAddress: task.creator_address as `0x${string}`,
      deadline: task.deadline,
      tags: task.tags,
      createdAt: task.created_at,
      submissionCount: task.submission_count,
      winnerAddress: task.winner_address,
      challengeDeadline: task.challenge_deadline,
    };
  });

  return {
    tasks: taskItems,
    total,
    hasMore: (input.offset || 0) + taskItems.length < total,
  };
}

/** Extended get task response with formatted bounty */
export interface GetTaskResponseWithFormatted extends GetTaskResponse {
  bountyFormatted: string;
  bountyTokenSymbol: string;
}

/**
 * Get a task by ID
 */
export async function getTaskHandler(
  input: GetTaskInput
): Promise<GetTaskResponseWithFormatted | null> {
  const chainId = getChainId();
  const task = await getTaskById(input.taskId);

  if (!task) {
    return null;
  }

  // Fetch specification from IPFS
  let specification;
  try {
    specification = await fetchTaskSpecification(task.specification_cid);
  } catch {
    specification = {
      title: task.title,
      description: task.description,
      deliverables: [],
    };
  }

  // Get token info for formatting
  const tokenConfig = getTokenByAddress(chainId, task.bounty_token);
  const decimals = tokenConfig?.decimals ?? 18;
  const symbol = tokenConfig?.symbol ?? 'ETH';
  const formatted = formatTokenAmount(BigInt(task.bounty_amount), decimals) + ' ' + symbol;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    bountyAmount: task.bounty_amount,
    bountyToken: task.bounty_token,
    bountyFormatted: formatted,
    bountyTokenSymbol: symbol,
    creator: task.creator_address,
    deadline: task.deadline,
    tags: task.tags,
    deliverables: specification.deliverables || [],
    requirements: specification.requirements,
    submissionCount: task.submission_count,
    winnerAddress: task.winner_address || undefined,
    selectedAt: task.selected_at || undefined,
    challengeDeadline: task.challenge_deadline || undefined,
    createdAt: task.created_at,
  };
}

/**
 * Create a new task
 * Note: This uploads to IPFS and prepares for on-chain creation
 */
export async function createTaskHandler(
  input: CreateTaskInput,
  _creatorAddress: `0x${string}`
): Promise<{
  specificationCid: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  specification: any;
}> {
  // Create specification
  const specification = {
    version: '1.0' as const,
    title: input.title,
    description: input.description,
    deliverables: input.deliverables,
    tags: input.tags,
    deadline: input.deadline,
  };

  // Upload to IPFS
  const uploadResult = await uploadTaskSpecification(specification);

  return {
    specificationCid: uploadResult.cid,
    specification,
  };
}
