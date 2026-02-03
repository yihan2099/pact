import { TaskManagerABI, getContractAddresses } from '@clawboy/contracts';
import { getPublicClient } from '../client/public-client';
import type { TaskStatus } from '@clawboy/shared-types';

/**
 * Get default chain ID from environment
 */
function getDefaultChainId(): number {
  return parseInt(process.env.CHAIN_ID || '84532', 10);
}

/**
 * Get TaskManager contract address
 */
export function getTaskManagerAddress(chainId?: number): `0x${string}` {
  const addresses = getContractAddresses(chainId || getDefaultChainId());
  return addresses.taskManager;
}

/**
 * Get task count from contract
 */
export async function getTaskCount(chainId?: number): Promise<bigint> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  return publicClient.readContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'taskCount',
  }) as Promise<bigint>;
}

/**
 * Get task by ID from contract (updated for competitive model)
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
  createdAtBlock: bigint;
  deadline: bigint;
  selectedWinner: `0x${string}`;
  selectedAt: bigint;
  challengeDeadline: bigint;
}> {
  const resolvedChainId = chainId || getDefaultChainId();
  const publicClient = getPublicClient(resolvedChainId);
  const addresses = getContractAddresses(resolvedChainId);

  const result = await publicClient.readContract({
    address: addresses.taskManager,
    abi: TaskManagerABI,
    functionName: 'getTask',
    args: [taskId],
  });

  // Viem returns tuple as array
  const task = result as unknown as readonly [
    bigint,         // id
    `0x${string}`,  // creator
    number,         // status
    bigint,         // bountyAmount
    `0x${string}`,  // bountyToken
    string,         // specificationCid
    bigint,         // createdAtBlock
    bigint,         // deadline
    `0x${string}`,  // selectedWinner
    bigint,         // selectedAt
    bigint          // challengeDeadline
  ];

  return {
    id: task[0],
    creator: task[1],
    status: task[2],
    bountyAmount: task[3],
    bountyToken: task[4],
    specificationCid: task[5],
    createdAtBlock: task[6],
    deadline: task[7],
    selectedWinner: task[8],
    selectedAt: task[9],
    challengeDeadline: task[10],
  };
}

/**
 * Convert contract status number to TaskStatus enum (updated for competitive model)
 */
export function contractStatusToTaskStatus(status: number): TaskStatus {
  const statusMap: Record<number, TaskStatus> = {
    0: 'open' as TaskStatus,
    1: 'in_review' as TaskStatus,
    2: 'completed' as TaskStatus,
    3: 'disputed' as TaskStatus,
    4: 'refunded' as TaskStatus,
    5: 'cancelled' as TaskStatus,
  };

  return statusMap[status] ?? ('open' as TaskStatus);
}
