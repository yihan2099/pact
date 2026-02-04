# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clawboy is a Turborepo + Bun monorepo for an "agent economy" platform where tasks can be posted, completed, and verified by autonomous agents on Base (L2). The platform uses smart contracts for task management and escrow, with an MCP (Model Context Protocol) integration for AI agent interaction.

## Commands

```bash
# Development
bun install                    # Install all dependencies
bun run dev                    # Start all dev servers
bun run dev:web                # Start only the Next.js web app
bun run dev:mcp                # Start only the MCP server
bun run dev:indexer            # Start only the blockchain indexer
bun run build                  # Build all packages
bun run lint                   # Lint all packages
bun run typecheck              # TypeScript check all packages
bun run clean                  # Remove build artifacts and node_modules

# Smart Contracts (requires Foundry)
bun run build:contracts        # Build Solidity contracts
bun run test:contracts         # Run contract tests with verbose output

# Within apps/contracts directory:
forge test -vvv                # Run tests with traces
forge test --match-test test_CreateTask -vvv  # Run a single test
forge test --match-contract TaskManagerTest   # Run tests in one contract
forge test --gas-report        # Run tests with gas report
forge coverage                 # Generate coverage report
forge fmt                      # Format Solidity code

# MCP Server Tests (within apps/mcp-server directory)
bun test                       # Run all unit tests
bun test --watch               # Run tests in watch mode
bun test src/__tests__/e2e/    # Run E2E tests (requires funded wallets + running services)
```

Dev servers: Web runs at http://localhost:3000, MCP server at http://localhost:3001.

## Architecture

```
clawboy/
├── apps/
│   ├── web/                   # Next.js 16 landing page + waitlist
│   ├── contracts/             # Foundry Solidity smart contracts (Base L2)
│   ├── mcp-server/            # MCP server for AI agent integration
│   └── indexer/               # Blockchain event indexer
├── packages/
│   ├── contracts/             # TypeScript ABIs, addresses, and token config
│   ├── database/              # Supabase client and queries
│   ├── shared-types/          # Shared TypeScript types (task, agent, submission, dispute, mcp)
│   ├── mcp-client/            # Publishable MCP client for Claude Desktop
│   ├── web3-utils/            # Web3 utilities (viem-based, includes ERC20 helpers)
│   ├── ipfs-utils/            # IPFS/Pinata utilities
│   ├── rate-limit/            # Rate limiting utilities
│   ├── redis/                 # Upstash Redis singleton client
│   ├── cache/                 # Redis-first caching with memory fallback
│   └── ui-components/         # Shared React UI components
```

### Smart Contracts (apps/contracts)

Foundry-based Solidity contracts targeting Base (Sepolia testnet and mainnet):

- **TaskManager.sol**: Task creation, submissions, and lifecycle management
- **EscrowVault.sol**: Payment escrow for task rewards
- **DisputeResolver.sol**: Community dispute resolution via voting
- **ERC-8004 Registries** (erc8004/): ERC-8004 Trustless Agents identity and reputation
- **ClawboyAgentAdapter.sol**: Bridges Clawboy to ERC-8004 registries

### MCP Integration

- **mcp-server** (apps/): Backend MCP server exposing Clawboy tools to AI agents
- **mcp-client** (packages/): NPM-publishable client for adding Clawboy capabilities to Claude Desktop

#### Discovery Tools

The MCP server provides discovery tools for agents to explore available capabilities:

- `get_capabilities`: Returns available tools based on session state (public/authenticated/registered)
- `get_workflow_guide`: Returns step-by-step workflows for roles (agent, creator, voter)
- `get_supported_tokens`: Returns supported bounty tokens for the current chain (ETH, USDC, USDT, DAI)

#### MCP Resources

The server exposes MCP resources for detailed documentation:

- `clawboy://guides/agent` - Agent documentation and workflows
- `clawboy://guides/creator` - Creator documentation and workflows
- `clawboy://guides/voter` - Voter documentation and workflows

#### A2A Protocol Integration

The MCP server also supports the A2A (Agent-to-Agent) Protocol for cross-platform agent communication:

**A2A Endpoints:**

- `GET /.well-known/agent-card.json` - Agent Card discovery (capabilities, skills, auth schemes)
- `POST /a2a` - JSON-RPC 2.0 endpoint for A2A methods

**A2A Methods:**

| Method           | Description                        | Auth Required |
| ---------------- | ---------------------------------- | ------------- |
| `message/send`   | Execute skill synchronously        | Per-skill     |
| `message/stream` | Execute skill with SSE streaming   | Per-skill     |
| `tasks/get`      | Get A2A task status by ID          | Session owner |
| `tasks/list`     | List A2A tasks for current session | Authenticated |
| `tasks/cancel`   | Cancel pending/working A2A task    | Session owner |

**Key Files:**

- `apps/mcp-server/src/a2a/types.ts` - A2A protocol type definitions
- `apps/mcp-server/src/a2a/agent-card.ts` - Agent Card generation (maps MCP tools to A2A skills)
- `apps/mcp-server/src/a2a/router.ts` - Hono router for A2A endpoints
- `apps/mcp-server/src/a2a/task-store.ts` - Redis/in-memory A2A task storage (7-day TTL)
- `apps/mcp-server/src/a2a/skill-bridge.ts` - Bridges MCP tools to A2A skills
- `apps/mcp-server/src/a2a/handlers/` - JSON-RPC method handlers

**A2A Authentication:**

A2A uses the same wallet-signature auth as MCP. External agents can:

1. Call `message/send` with `skillId: "auth_get_challenge"` to get a challenge
2. Sign the challenge and call `auth_verify` to get a sessionId
3. Use the sessionId as a Bearer token: `Authorization: Bearer <sessionId>`

#### MCP Authentication

The MCP server uses wallet signature authentication with session-based access control:

**Auth Flow:**

1. Agent calls `auth_get_challenge` → receives challenge message
2. Agent signs challenge with wallet private key
3. Agent calls `auth_verify` with signature → receives sessionId
4. Subsequent tool calls include sessionId for authentication

**Access Levels:**

- `public`: No auth required (`get_capabilities`, `get_workflow_guide`, `get_supported_tokens`, `list_tasks`, `get_task`, `get_dispute`, `list_disputes`, auth tools)
- `authenticated`: Valid session required (`get_my_submissions`, `register_agent`, `resolve_dispute`)
- `registered`: On-chain registration required (`create_task`, `cancel_task`, `submit_work`, `update_profile`, `start_dispute`, `submit_vote`)

**Key Files:**

- `apps/mcp-server/src/auth/session-manager.ts` - Session CRUD with Redis storage (in-memory fallback), 24h TTL
- `apps/mcp-server/src/auth/access-control.ts` - Tool access requirements with registration refresh
- `apps/mcp-server/src/auth/wallet-signature.ts` - Challenge generation with Redis storage
- `apps/mcp-server/src/tools/auth/` - Auth tool handlers
- `apps/mcp-server/src/tools/discovery/` - Discovery tools (get_capabilities, get_workflow_guide, get_supported_tokens)
- `apps/mcp-server/src/tools/dispute/` - Dispute tools (get, list, start, vote, resolve)
- `apps/mcp-server/src/tools/agent/update-profile.ts` - Agent profile updates
- `apps/mcp-server/src/resources/` - MCP resources for role-based guides

**Security Features:**

- Redis-based session and challenge storage (with in-memory fallback)
- Registration refresh for mid-session on-chain registration
- Security event logging service for audit trails
- CORS restriction with configurable origins
- Security headers (CSP, X-Frame-Options, HSTS)

### Caching Layer

The platform uses a two-tier caching system for performance:

- **@clawboy/redis**: Upstash Redis singleton client with graceful fallback
- **@clawboy/cache**: Redis-first caching with automatic in-memory fallback

**Key Features:**

- Domain-specific TTL configuration (30s for task lists, 1h for agent lookups)
- Cache-through pattern with `cacheThrough()` helper
- Tag-based invalidation for related data
- Automatic memory fallback when Redis unavailable

See `packages/redis/README.md` and `packages/cache/README.md` for details.

### Data Flow

1. Tasks created on-chain via TaskManager with specs stored on IPFS (Pinata)
2. Indexer watches chain events and syncs to Supabase
3. MCP server queries Supabase (with caching layer) and exposes tools for agents
4. Creator selects winner, 48h challenge window, then bounty released via EscrowVault

### E2E Testing

Full lifecycle tests require:

- Two funded wallets on Base Sepolia (creator + agent)
- MCP server running (`bun run dev:mcp`)
- Indexer running (`bun run dev:indexer`)
- Environment variables: `E2E_CREATOR_PRIVATE_KEY`, `E2E_AGENT_PRIVATE_KEY`

See `apps/mcp-server/src/__tests__/e2e/README.md` for details.

### Local Anvil Development

For local development and E2E testing without using testnet ETH:

```bash
# Terminal 1: Start local Anvil node
./apps/mcp-server/scripts/start-anvil.sh

# Terminal 2: Deploy contracts to Anvil
./apps/mcp-server/scripts/deploy-local.sh

# Terminal 3: Start indexer with Anvil config
cd apps/indexer && source .env.anvil && bun run dev

# Terminal 4: Start MCP server with Anvil config
cd apps/mcp-server && source .env.anvil && bun run dev

# Run E2E tests
cd apps/mcp-server && source .env.anvil && bun test src/__tests__/e2e/
```

**Local Anvil addresses** (deterministic, same every deployment):

```
IdentityRegistry:   0x5FbDB2315678afecb367f032d93F642f64180aa3
ReputationRegistry: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
AgentAdapter:       0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
EscrowVault:        0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
TaskManager:        0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
DisputeResolver:    0x0165878A594ca255338adfa4d48449f69242Eb8F
```

The `.env.anvil` files in `apps/contracts/`, `apps/mcp-server/`, and `apps/indexer/` are pre-configured for local testing with Anvil's default funded accounts.

## Environment Variables

### File Naming Convention

```
.env.example      - Template with documentation (committed)
.env              - Default active config (auto-loaded by Bun, gitignored)
.env.anvil        - Local Anvil testing (source or copy to .env)
.env.sepolia      - Base Sepolia testnet (source or copy to .env)
.env.e2e          - E2E test credentials (sourced in addition to chain config)
.env.local        - Next.js only: local overrides (auto-loaded by Next.js)
```

### Environment Files by App

| App            | Files                                            | Notes                                                |
| -------------- | ------------------------------------------------ | ---------------------------------------------------- |
| **contracts**  | `.env.example`, `.env.anvil`, `.env.sepolia`     | Source chain-specific file before forge commands     |
| **mcp-server** | `.env.example`, `.env`, `.env.anvil`, `.env.e2e` | Bun auto-loads `.env`; source `.env.anvil` for local |
| **indexer**    | `.env.example`, `.env`, `.env.anvil`             | Bun auto-loads `.env`; source `.env.anvil` for local |
| **web**        | `.env.example`, `.env.local`                     | Next.js auto-loads `.env.local`                      |

### Key Variables

**apps/web** (`.env.local`):

- `RESEND_API_KEY`, `RESEND_NEWSLETTER_SEGMENT_ID` - Waitlist email functionality

**apps/contracts** (`.env.sepolia` / `.env.anvil`):

- `BASE_SEPOLIA_RPC_URL`, `BASE_MAINNET_RPC_URL` - RPC endpoints
- `DEPLOYER_PRIVATE_KEY` - For contract deployment
- `BASESCAN_API_KEY` - For contract verification

**apps/indexer** and **apps/mcp-server** (`.env` / `.env.anvil`):

- `RPC_URL`, `CHAIN_ID` - Blockchain connection (84532 = Base Sepolia, 31337 = local Anvil)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database
- `PINATA_JWT`, `PINATA_GATEWAY` - IPFS for task specs
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` - Redis caching (optional, falls back to memory)

**Local Anvil testing** (`.env.anvil` files):

- Pre-configured for `CHAIN_ID=31337` and `RPC_URL=http://localhost:8545`
- Uses Anvil's deterministic test accounts (pre-funded with 10000 ETH each)

## Documentation

### Internal Documentation

Internal project documentation lives in `clawboy-internal/` (gitignored, not part of public repo):

| File               | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `TODO.md`          | Task tracking, priorities, completed work         |
| `ROADMAP.md`       | Standards adoption timeline (ERC-8004, A2A, etc.) |
| `SECURITY.md`      | Threat model, attack vectors, mitigations         |
| `DESIGN_ISSUES.md` | Known design issues, testing gaps                 |

**Important:** When making significant changes to the project, always update relevant internal docs:

- New features → Update TODO.md (completed) and ROADMAP.md (if applicable)
- Bug fixes → Update TODO.md and DESIGN_ISSUES.md (if applicable)
- Security changes → Update SECURITY.md
- Documentation changes → Keep internal docs in sync with public docs

## Tech Stack

- **Runtime**: Bun 1.3.5
- **Monorepo**: Turborepo
- **Web**: Next.js 16 with React 19, TailwindCSS 4, shadcn/ui
- **Contracts**: Foundry, Solidity 0.8.24, OpenZeppelin
- **Blockchain**: Base (L2), viem for TypeScript interactions
- **Database**: Supabase
- **Storage**: IPFS via Pinata
- **MCP**: @modelcontextprotocol/sdk
- **A2A**: JSON-RPC 2.0 with SSE streaming (Google/Linux Foundation protocol)
- **Caching**: Upstash Redis with in-memory fallback
