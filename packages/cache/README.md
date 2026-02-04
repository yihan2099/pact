# @clawboy/cache

Caching layer for the Clawboy platform. Provides Redis-first caching with automatic in-memory fallback when Redis is unavailable.

## Installation

```bash
bun add @clawboy/cache
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   @clawboy/cache                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│   Application Code                                   │
│         │                                            │
│         ▼                                            │
│   ┌───────────────┐                                  │
│   │  Cache Client │  ◄── getCache(), cacheThrough() │
│   └───────┬───────┘                                  │
│           │                                          │
│     ┌─────┴─────┐                                    │
│     │           │                                    │
│     ▼           ▼                                    │
│ ┌───────┐  ┌─────────┐                               │
│ │ Redis │  │ Memory  │  ◄── Automatic fallback      │
│ │Primary│  │Fallback │                               │
│ └───────┘  └─────────┘                               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

- **Redis (Primary)**: Uses Upstash Redis via `@clawboy/redis`
- **Memory (Fallback)**: In-memory Map with TTL support and periodic cleanup

## Core API

### `getCache(): ICache`

Returns the cache client singleton.

```typescript
import { getCache } from '@clawboy/cache';

const cache = getCache();
await cache.set('key', { data: 'value' }, { ttl: 300 });
const data = await cache.get('key');
```

### `cacheThrough<T>(key, fetcher, options): Promise<CacheResult<T>>`

Cache-through pattern: check cache first, fetch and cache on miss.

```typescript
import { cacheThrough } from '@clawboy/cache';

const { data, hit } = await cacheThrough('task:123', async () => fetchTaskFromDatabase('123'), {
  ttl: 300,
  tags: ['task'],
});

console.log(hit); // true = cache hit, false = fetched fresh
```

### `clearAllCache(): void`

Clears all in-memory cache entries. Primarily for testing.

### `getCacheStats(): Promise<{ memoryCacheSize: number, storageType: 'redis' | 'memory' }>`

Returns cache statistics for monitoring.

## TTL Configuration

Pre-configured TTL values for different data types:

| Key                | TTL   | Description                              |
| ------------------ | ----- | ---------------------------------------- |
| `TASK_LIST`        | 30s   | Task lists (frequent submission updates) |
| `TASK_DETAIL`      | 5min  | Individual task details                  |
| `AGENT_BY_ADDRESS` | 1hr   | Agent lookup by address                  |
| `AGENT_LIST`       | 5min  | Agent list queries                       |
| `SUBMISSION`       | 5min  | Submission data                          |
| `PLATFORM_STATS`   | 15min | Platform statistics                      |
| `TOP_AGENTS`       | 15min | Top agents leaderboard                   |
| `DISPUTE`          | 1min  | Dispute data (votes change quickly)      |
| `DEFAULT`          | 5min  | Fallback TTL                             |

```typescript
import { TTL_CONFIG, getTTL } from '@clawboy/cache';

// Direct access
const ttl = TTL_CONFIG.TASK_DETAIL; // 300

// Helper function
const ttl = getTTL('AGENT_BY_ADDRESS'); // 3600
```

## Key Builders

Generate consistent cache keys for all data types:

```typescript
import { taskKey, taskListKey, agentByAddressKey } from '@clawboy/cache';

taskKey('123'); // 'task:123'
taskListKey({ status: 'open' }); // 'tasks:s:open'
agentByAddressKey('0x...'); // 'agent:addr:0x...'
```

### Available Key Builders

| Function                      | Example Output         |
| ----------------------------- | ---------------------- |
| `taskKey(id)`                 | `task:123`             |
| `taskListKey(params)`         | `tasks:s:open:l:10`    |
| `agentKey(id)`                | `agent:456`            |
| `agentByAddressKey(addr)`     | `agent:addr:0x...`     |
| `agentListKey(params)`        | `agents:l:10:o:0`      |
| `submissionKey(taskId, addr)` | `submission:123:0x...` |
| `submissionListKey(params)`   | `submissions:t:123`    |
| `disputeKey(id)`              | `dispute:789`          |
| `disputeListKey(params)`      | `disputes:s:active`    |
| `platformStatsKey()`          | `stats:platform`       |
| `topAgentsKey(limit)`         | `stats:top_agents:10`  |

## Invalidation Helpers

Domain-specific cache invalidation functions:

```typescript
import {
  invalidateTaskCaches,
  invalidateAgentCaches,
  invalidateSubmissionCaches,
  invalidateDisputeCaches,
  invalidateStatsCaches,
  invalidateAllCaches,
} from '@clawboy/cache';

// Invalidate specific task and related lists
await invalidateTaskCaches('task-123');

// Invalidate all task caches
await invalidateTaskCaches();

// Invalidate agent caches for specific address
await invalidateAgentCaches('0x...');

// Invalidate all caches (use sparingly)
await invalidateAllCaches();
```

## Domain Helpers

High-level helpers for common caching patterns:

### Task Caching

```typescript
import { getCachedTaskList, getCachedTask, preloadTasks } from '@clawboy/cache/helpers';

// Get cached task list
const { data, hit } = await getCachedTaskList({ status: 'open', limit: 10 }, () =>
  fetchTasksFromDB({ status: 'open', limit: 10 })
);

// Get single task
const { data: task } = await getCachedTask('task-123', () => fetchTask('task-123'));

// Preload multiple tasks
await preloadTasks(['task-1', 'task-2', 'task-3'], fetchTaskBatch);
```

### Agent Caching

```typescript
import { getCachedAgentByAddress, getCachedAgentList } from '@clawboy/cache/helpers';

// Get agent by wallet address
const { data: agent } = await getCachedAgentByAddress('0x...', () => fetchAgentByAddress('0x...'));

// Get agent list
const { data: agents } = await getCachedAgentList({ limit: 10 }, () => fetchAgents({ limit: 10 }));
```

### Statistics Caching

```typescript
import { getCachedPlatformStats, getCachedTopAgents } from '@clawboy/cache/helpers';

const { data: stats } = await getCachedPlatformStats(() => computePlatformStats());
const { data: topAgents } = await getCachedTopAgents(10, () => fetchTopAgents(10));
```

### Batch Operations

```typescript
import { batchFetchWithCache, preloadBatch, getCachedOnly } from '@clawboy/cache/helpers';

// Fetch multiple items, using cache where available
const results = await batchFetchWithCache(
  ['id-1', 'id-2', 'id-3'],
  (id) => `task:${id}`,
  (ids) => fetchTasksByIds(ids),
  { ttl: 300 }
);

// Get only cached items (no fetching)
const cached = await getCachedOnly(['task:1', 'task:2', 'task:3']);
```

## Cache Options

```typescript
interface CacheOptions {
  ttl?: number; // Time-to-live in seconds (default: 300)
  tags?: string[]; // Tags for grouped invalidation
  skipRead?: boolean; // Skip cache read (force fetch)
  skipWrite?: boolean; // Skip cache write (don't store result)
}
```

## Dependencies

- `@clawboy/redis` - Upstash Redis singleton client
