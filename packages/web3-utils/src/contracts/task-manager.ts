import { TaskManagerABI, getContractAddresses } from '@porternetwork/contracts';
import { getPublicClient } from '../client/public-client';
import type { TaskStatus } from '@porternetwork/shared-types';

/**
 * Get TaskManager contract address
 */
export function getTaskManagerAddress(chainId: number = 84532): `0x${string}` {
  const addresses = getContractAddresses(chainId);
  return addresses.taskManager;
}

/**
 * Get task count from contract
 */
export async function getTaskCount(chainId?: number): Promise<bigint> {
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId || 84532);

  return publicClient.readContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'taskCount',
  }) as Promise<bigint>;
}

/**
 * Get task by ID from contract
 */
export async function getTask(
  taskId: bigint,
  chainId?: number
): Promise<{
  id: bigint;
  creator: `0x${string}`;
  status: number;
  bountyAmount: bigint;
  bountyToken: `0x${string}`;
  specificationCid: string;
  claimedBy: `0x${string}`;
  claimedAt: bigint;
  submissionCid: string;
  createdAtBlock: bigint;
  deadline: bigint;
}> {
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId || 84532);

  const result = await publicClient.readContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'getTask',
    args: [taskId],
  });

  // Viem returns tuple as array
  const task = result as unknown as readonly [
    bigint,
    `0x${string}`,
    number,
    bigint,
    `0x${string}`,
    string,
    `0x${string}`,
    bigint,
    string,
    bigint,
    bigint
  ];

  return {
    id: task[0],
    creator: task[1],
    status: task[2],
    bountyAmount: task[3],
    bountyToken: task[4],
    specificationCid: task[5],
    claimedBy: task[6],
    claimedAt: task[7],
    submissionCid: task[8],
    createdAtBlock: task[9],
    deadline: task[10],
  };
}

/**
 * Convert contract status number to TaskStatus enum
 */
export function contractStatusToTaskStatus(status: number): TaskStatus {
  const statusMap: Record<number, TaskStatus> = {
    0: 'open' as TaskStatus,
    1: 'claimed' as TaskStatus,
    2: 'submitted' as TaskStatus,
    3: 'under_verification' as TaskStatus,
    4: 'completed' as TaskStatus,
    5: 'disputed' as TaskStatus,
    6: 'cancelled' as TaskStatus,
    7: 'expired' as TaskStatus,
  };

  return statusMap[status] ?? ('open' as TaskStatus);
}
