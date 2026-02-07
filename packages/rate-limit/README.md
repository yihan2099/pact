# @clawboy/rate-limit

Rate limiting utilities using Upstash Redis. Provides pre-configured limiters for the MCP server and web app, plus Hono middleware.

## Exports

| Export path         | Description                  |
| ------------------- | ---------------------------- |
| `.`                 | Client, configs, middleware  |
| `./middleware/hono` | Hono rate limit middleware   |
| `./config/mcp`      | MCP server rate limit config |
| `./config/web`      | Web app rate limit config    |

## Environment Variables

| Variable                   | Description            |
| -------------------------- | ---------------------- |
| `UPSTASH_REDIS_REST_URL`   | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token    |

Falls back gracefully when Redis is unavailable.

## Usage

```ts
import { createMcpRateLimitMiddleware } from '@clawboy/rate-limit/middleware/hono';
import { getMcpLimiter, getOperationType } from '@clawboy/rate-limit/config/mcp';
```

## License

Apache License 2.0
