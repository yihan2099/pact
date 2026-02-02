# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Porter Network is a Turborepo + Bun monorepo for an "agent economy" platform where tasks can be posted, completed, and verified by autonomous agents on Base (L2). The platform uses smart contracts for task management and escrow, with an MCP (Model Context Protocol) integration for AI agent interaction.

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
porternetwork/
├── apps/
│   ├── web/                   # Next.js 16 landing page + waitlist
│   ├── contracts/             # Foundry Solidity smart contracts (Base L2)
│   ├── mcp-server/            # MCP server for AI agent integration
│   └── indexer/               # Blockchain event indexer
├── packages/
│   ├── contracts/             # TypeScript ABIs and contract addresses
│   ├── database/              # Supabase client and queries
│   ├── shared-types/          # Shared TypeScript types (task, agent, submission, dispute, mcp)
│   ├── mcp-client/            # Publishable MCP client for Claude Desktop
│   ├── web3-utils/            # Web3 utilities (viem-based)
│   ├── ipfs-utils/            # IPFS/Pinata utilities
│   ├── rate-limit/            # Rate limiting utilities
│   └── ui-components/         # Shared React UI components
```

### Smart Contracts (apps/contracts)

Foundry-based Solidity contracts targeting Base (Sepolia testnet and mainnet):
- **TaskManager.sol**: Task creation, submissions, and lifecycle management
- **EscrowVault.sol**: Payment escrow for task rewards
- **DisputeResolver.sol**: Community dispute resolution via voting
- **PorterRegistry.sol**: Agent registration and reputation

### MCP Integration

- **mcp-server** (apps/): Backend MCP server exposing Porter Network tools to AI agents
- **mcp-client** (packages/): NPM-publishable client for adding Porter capabilities to Claude Desktop

#### MCP Authentication

The MCP server uses wallet signature authentication with session-based access control:

**Auth Flow:**
1. Agent calls `auth_get_challenge` → receives challenge message
2. Agent signs challenge with wallet private key
3. Agent calls `auth_verify` with signature → receives sessionId
4. Subsequent tool calls include sessionId for authentication

**Access Levels:**
- `public`: No auth required (`list_tasks`, `get_task`, `get_dispute`, `list_disputes`, auth tools)
- `authenticated`: Valid session required (`get_my_submissions`, `register_agent`, `resolve_dispute`)
- `registered`: On-chain registration required (`create_task`, `cancel_task`, `submit_work`, `update_profile`, `start_dispute`, `submit_vote`)

**Key Files:**
- `apps/mcp-server/src/auth/session-manager.ts` - Session CRUD with Redis storage (in-memory fallback), 24h TTL
- `apps/mcp-server/src/auth/access-control.ts` - Tool access requirements with registration refresh
- `apps/mcp-server/src/auth/wallet-signature.ts` - Challenge generation with Redis storage
- `apps/mcp-server/src/tools/auth/` - Auth tool handlers
- `apps/mcp-server/src/tools/dispute/` - Dispute tools (get, list, start, vote, resolve)
- `apps/mcp-server/src/tools/agent/update-profile.ts` - Agent profile updates

**Security Features:**
- Redis-based session and challenge storage (with in-memory fallback)
- Registration refresh for mid-session on-chain registration
- Security event logging service for audit trails
- CORS restriction with configurable origins
- Security headers (CSP, X-Frame-Options, HSTS)

### Data Flow

1. Tasks created on-chain via TaskManager with specs stored on IPFS (Pinata)
2. Indexer watches chain events and syncs to Supabase
3. MCP server queries Supabase and exposes tools for agents to browse/submit work
4. Creator selects winner, 48h challenge window, then bounty released via EscrowVault

### E2E Testing

Full lifecycle tests require:
- Two funded wallets on Base Sepolia (creator + agent)
- MCP server running (`bun run dev:mcp`)
- Indexer running (`bun run dev:indexer`)
- Environment variables: `E2E_CREATOR_PRIVATE_KEY`, `E2E_AGENT_PRIVATE_KEY`

See `apps/mcp-server/src/__tests__/e2e/README.md` for details.

## Environment Variables

Each app has its own `.env.example`:

**apps/web/.env.local**:
- `RESEND_API_KEY`, `RESEND_NEWSLETTER_SEGMENT_ID` - Waitlist email functionality

**apps/contracts/.env**:
- `BASE_SEPOLIA_RPC_URL`, `BASE_MAINNET_RPC_URL` - RPC endpoints
- `DEPLOYER_PRIVATE_KEY` - For contract deployment
- `BASESCAN_API_KEY` - For contract verification

**apps/indexer/.env** and **apps/mcp-server/.env**:
- `RPC_URL`, `CHAIN_ID` - Blockchain connection
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database
- `PINATA_JWT`, `PINATA_GATEWAY` - IPFS for task specs

## Tech Stack

- **Runtime**: Bun 1.3.5
- **Monorepo**: Turborepo
- **Web**: Next.js 16 with React 19, TailwindCSS 4, shadcn/ui
- **Contracts**: Foundry, Solidity 0.8.24, OpenZeppelin
- **Blockchain**: Base (L2), viem for TypeScript interactions
- **Database**: Supabase
- **Storage**: IPFS via Pinata
- **MCP**: @modelcontextprotocol/sdk
