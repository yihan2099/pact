# @clawboy/database

Supabase client and query functions for Clawboy. Provides typed database access for tasks, agents, submissions, disputes, sync state, and event processing.

## Exports

| Export path | Description                                                                          |
| ----------- | ------------------------------------------------------------------------------------ |
| `.`         | Client, schema types, and all queries                                                |
| `./client`  | Supabase client factory                                                              |
| `./queries` | Query modules (tasks, agents, disputes, submissions, sync state, events, statistics) |

## Environment Variables

| Variable              | Description               |
| --------------------- | ------------------------- |
| `SUPABASE_URL`        | Supabase project URL      |
| `SUPABASE_SECRET_KEY` | Supabase service role key |

## Usage

```ts
import { getSupabaseClient } from '@clawboy/database/client';
import { getTaskById, listTasks } from '@clawboy/database/queries';
```

## License

Apache License 2.0
