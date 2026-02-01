import { listTasks, getTaskById, createTask, updateTask } from '@porternetwork/database';
import { fetchTaskSpecification, uploadTaskSpecification } from '@porternetwork/ipfs-utils';
import type { ListTasksInput, CreateTaskInput, GetTaskInput } from '@porternetwork/shared-types';
import type { TaskListItem, GetTaskResponse, CreateTaskResponse } from '@porternetwork/shared-types';

/**
 * List tasks with filters
 */
export async function listTasksHandler(
  input: ListTasksInput
): Promise<{ tasks: TaskListItem[]; total: number; hasMore: boolean }> {
  // Map sortBy field names
  let sortBy: 'created_at' | 'deadline' | 'bounty_amount' | undefined;
  if (input.sortBy === 'bounty') {
    sortBy = 'bounty_amount';
  } else if (input.sortBy === 'createdAt') {
    sortBy = 'created_at';
  } else if (input.sortBy === 'deadline') {
    sortBy = 'deadline';
  }

  const { tasks, total } = await listTasks({
    status: input.status as any,
    tags: input.tags,
    limit: input.limit || 20,
    offset: input.offset || 0,
    sortBy,
    sortOrder: input.sortOrder,
  });

  const taskItems: TaskListItem[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    bountyAmount: task.bounty_amount,
    bountyToken: task.bounty_token as `0x${string}`,
    status: task.status as any,
    creatorAddress: task.creator_address as `0x${string}`,
    deadline: task.deadline,
    tags: task.tags,
    createdAt: task.created_at,
  }));

  return {
    tasks: taskItems,
    total,
    hasMore: (input.offset || 0) + taskItems.length < total,
  };
}

/**
 * Get a task by ID
 */
export async function getTaskHandler(
  input: GetTaskInput
): Promise<GetTaskResponse | null> {
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

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    bountyAmount: task.bounty_amount,
    bountyToken: task.bounty_token,
    creator: task.creator_address,
    deadline: task.deadline,
    tags: task.tags,
    deliverables: specification.deliverables || [],
    requirements: specification.requirements,
    claimedBy: task.claimed_by || undefined,
    claimedAt: task.claimed_at || undefined,
    submissionCid: task.submission_cid || undefined,
    createdAt: task.created_at,
  };
}

/**
 * Create a new task
 * Note: This uploads to IPFS and prepares for on-chain creation
 */
export async function createTaskHandler(
  input: CreateTaskInput,
  creatorAddress: `0x${string}`
): Promise<{
  specificationCid: string;
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
