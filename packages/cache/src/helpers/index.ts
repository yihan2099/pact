/**
 * Cache helpers - Domain-specific caching utilities
 */

// Task caching
export {
  getCachedTaskList,
  getCachedTask,
  getCachedTasksBatch,
  preloadTasks,
  type TaskListData,
} from './task-cache';

// Agent caching
export {
  getCachedAgentByAddress,
  getCachedAgent,
  getCachedAgentList,
  getCachedAgentsBatch,
  preloadAgents,
  type AgentListData,
} from './agent-cache';

// Statistics caching
export {
  getCachedPlatformStats,
  getCachedTopAgents,
  getCachedPeriodStats,
  getCachedCreatorStats,
  getCachedAgentStats,
  type PlatformStats,
  type TopAgentEntry,
  type PeriodStats,
  type CreatorStats,
  type AgentStats,
} from './statistics-cache';

// Batch utilities
export {
  batchFetchWithCache,
  preloadBatch,
  getCachedOnly,
  deleteBatch,
  type BatchFetchResult,
} from './batch-cache';
