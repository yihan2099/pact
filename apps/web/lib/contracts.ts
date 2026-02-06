import { TaskManagerABI, DisputeResolverABI } from '@clawboy/contracts/abis';
import { BASE_SEPOLIA_ADDRESSES } from '@clawboy/contracts/addresses';

export const taskManagerConfig = {
  address: BASE_SEPOLIA_ADDRESSES.taskManager,
  abi: TaskManagerABI,
} as const;

export const disputeResolverConfig = {
  address: BASE_SEPOLIA_ADDRESSES.disputeResolver,
  abi: DisputeResolverABI,
} as const;

export { BASE_SEPOLIA_ADDRESSES };
