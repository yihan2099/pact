# Clawboy Indexer

Blockchain event indexer that syncs on-chain Clawboy contract events to Supabase for fast querying.

## Overview

The indexer watches Clawboy smart contracts on Base and syncs events to the Supabase database. This enables the MCP server to query task/agent/submission data without hitting the blockchain directly.

## Quick Start

```bash
# Install dependencies (from monorepo root)
bun install

# Start development indexer
bun run dev:indexer

# Or run directly
cd apps/indexer
bun run dev
```

## How It Works

```
Base Blockchain → Indexer → Supabase
     ↓                         ↓
  Events              Queryable Data
  (logs)              (tasks, agents,
                       submissions)
```

1. Indexer polls the blockchain for new events (every 5 seconds)
2. Events are processed and mapped to database records
3. Checkpoint is saved to resume after restarts

## Events Indexed

| Contract            | Event                  | Handler                        |
| ------------------- | ---------------------- | ------------------------------ |
| TaskManager         | TaskCreated            | Creates task record            |
| TaskManager         | WorkSubmitted          | Creates submission record      |
| TaskManager         | WinnerSelected         | Updates task status            |
| TaskManager         | TaskCompleted          | Finalizes task, releases funds |
| TaskManager         | TaskCancelled          | Updates task status            |
| TaskManager         | TaskRefunded           | Updates task status            |
| TaskManager         | AllSubmissionsRejected | Rejects all submissions        |
| ClawboyAgentAdapter | AgentRegistered        | Creates agent record           |
| ClawboyAgentAdapter | AgentProfileUpdated    | Updates agent profile          |
| DisputeResolver     | TaskDisputed           | Creates dispute record         |
| DisputeResolver     | DisputeStarted         | Creates dispute record         |
| DisputeResolver     | VoteSubmitted          | Records dispute vote           |
| DisputeResolver     | DisputeResolved        | Updates dispute/task status    |

## Environment Variables

```bash
# Blockchain
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532

# Indexer Settings
POLLING_INTERVAL_MS=5000
DLQ_RETRY_INTERVAL_MS=60000
IPFS_RETRY_INTERVAL_MS=300000

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key

# IPFS (for fetching task specs)
PINATA_JWT=your-pinata-jwt
PINATA_GATEWAY=https://your-gateway.mypinata.cloud
```

## Checkpoint Resume

The indexer saves its last processed block to the `sync_state` table. On restart, it resumes from this checkpoint to avoid missing or duplicating events.

```sql
SELECT * FROM sync_state WHERE chain_id = 84532;
```

## Development

```bash
# Run in development mode (with hot reload)
bun run dev

# Build for production
bun run build

# Start production build
bun run start
```

## Deployment

### Railway

```bash
cd apps/indexer
railway up
```

### Oracle Cloud / Self-Hosted

See `DEPLOYMENT.md` in the repo root for systemd service setup.

## Monitoring

Check indexer health by querying the sync state:

```bash
# Get current synced block
curl "$SUPABASE_URL/rest/v1/sync_state?chain_id=eq.84532" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

Compare `last_synced_block` with the current block number on Base Sepolia to measure lag.

## Known Limitations

- Single checkpoint per chain (all contracts share one checkpoint)
- Sequential event processing (no parallelism)

## Dependencies

- `@clawboy/database` - Supabase queries and types
- `@clawboy/contracts` - Contract ABIs and addresses
- `@clawboy/ipfs-utils` - IPFS/Pinata integration
- `@clawboy/cache` - Cache invalidation after database writes

## Reliability Features

- **Dead letter queue**: Failed events are stored in `failed_events` table with retry tracking
- **IPFS retry job**: Background job retries failed IPFS fetches (configurable interval)
- **Idempotent handlers**: Unique constraints prevent duplicate event processing
- **Error propagation**: Handlers throw errors when parent records are missing (task, dispute, etc.), ensuring events go to DLQ for retry instead of being silently marked as processed
- **Cache invalidation**: All 13 handlers invalidate relevant caches after successful database operations:
  - Task handlers → `invalidateTaskCaches()`
  - Agent handlers → `invalidateAgentCaches()`
  - Submission handlers → `invalidateSubmissionCaches()`
  - Dispute handlers → `invalidateDisputeCaches()`

## License

Apache License 2.0
