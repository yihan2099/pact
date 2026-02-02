# Porter Network TODO

> Last Updated: 2026-02-02

## Priority Legend

- **P0: Blocking** - Must complete before any testing
- **P1: Critical** - Required for end-to-end flow
- **P2: Important** - Production readiness
- **P3: Nice-to-have** - Polish and optimization

---

## P0: Infrastructure Setup ✅

All infrastructure setup is complete. See [DEPLOYMENT.md](./DEPLOYMENT.md) for details.

- [x] Install Foundry CLI (`curl -L https://foundry.paradigm.xyz | bash`)
- [x] Compile contracts (`cd apps/contracts && forge build`)
- [x] Run contract tests (`forge test -vvv`)
- [x] Create Supabase project at [supabase.com](https://supabase.com)
- [x] Run SQL migrations from `packages/database/src/migrations/`
- [x] Create Pinata account at [pinata.cloud](https://pinata.cloud) and get API keys
- [x] Configure all `.env` files:
  - [x] `apps/contracts/.env` (RPC URLs, deployer key)
  - [x] `apps/mcp-server/.env` (Supabase, Pinata, RPC)
  - [x] `apps/indexer/.env` (Supabase, RPC)

---

## P1: Deployment & Integration

Required for a working end-to-end flow.

### Smart Contracts ✅
- [x] Deploy contracts to Base Sepolia testnet
  - Initial deployment (block 37116678) - verification-based system
  - **Redeployed (2025-02-02)** - competitive task system with selectWinner, 48h challenge window, community disputes
  ```bash
  cd apps/contracts
  forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
  ```
- [x] Verify contracts on Basescan (all 4 contracts verified)
- [x] Update contract addresses in `packages/contracts/src/addresses/base-sepolia.ts`

**Current Contract Addresses (Base Sepolia):**
| Contract | Address |
|----------|---------|
| PorterRegistry | `0x2d136042424dC00cf859c81b664CC78fbE139bD5` |
| EscrowVault | `0x91256394De003C99B9F47b4a4Ea396B9A305fc8F` |
| TaskManager | `0x337Ef0C02D1f9788E914BE4391c9Dd8140F94E2E` |
| DisputeResolver | `0x8964586a472cf6b363C2339289ded3D2140C397F` |

### Backend Services ✅
- [x] Deploy MCP server (Railway)
- [x] Deploy indexer service (Railway)
- [x] Configure production environment variables
- [x] Document Oracle Cloud as alternative deployment option

### Integration Testing ✅
- [x] End-to-end test: Full task lifecycle
  - [x] Create task with bounty
  - [x] Agent submits work (competitive)
  - [x] Creator selects winner
  - [x] 48h challenge window verification (helper functions added)
  - [x] Finalization helpers added (requires waiting 48h on testnet)
- [x] Test session expiration and re-authentication
- [x] Test checkpoint resume (restart indexer, verify no missed events)

---

## P2: Production Readiness

Required before mainnet launch.

### Security
- [ ] Smart contract audit (external)
- [ ] MCP server security review
- [x] Rate limiting implementation (packages/rate-limit, integrated in MCP server)
- [ ] Input sanitization audit

### Reliability
- [ ] Error alerting (Sentry, PagerDuty, or similar)
- [ ] Database backups configured
- [ ] Indexer health monitoring
- [ ] Graceful shutdown handling

### Operations
- [ ] Deployment documentation
- [ ] Runbook for common issues
- [ ] Monitoring dashboards

---

## Smart Contract Upgradeability Strategy

### Current State: Immutable Contracts

Porter Network contracts are currently **non-upgradeable** (immutable). Every version update requires deploying new contracts at new addresses.

**How Version Updates Work Today:**
1. Make contract changes (e.g., bug fix, new feature)
2. Deploy entirely new contracts → new addresses
3. Update `packages/contracts/src/addresses/*.ts` with new addresses
4. Redeploy all services (MCP server, indexer, web app) to point to new contracts
5. Old contracts remain on-chain but become inactive

**Version Types:**
- **Patch (v1.0.0 → v1.0.1)**: Bug fixes, security patches
- **Minor (v1.0.0 → v1.1.0)**: New features (backward compatible)
- **Major (v1.0.0 → v2.0.0)**: Breaking changes (interface changes, state changes)

**Trade-offs:**
- ✅ **Pros**: Simpler code, lower gas costs, more secure (no upgrade risks), transparent to users
- ❌ **Cons**: Cannot fix bugs without redeployment, users must migrate, data migration complexity

### Path to Upgradeability

If frequent updates or bug fixes become necessary, consider implementing upgradeability for v2.0.0.

#### Option 1: Transparent Proxy Pattern (OpenZeppelin)

**Implementation:**
- [ ] **Phase 1: Add OpenZeppelin Upgrades**
  ```bash
  cd apps/contracts
  forge install OpenZeppelin/openzeppelin-contracts-upgradeable
  ```

- [ ] **Phase 2: Convert Contracts to Upgradeable**
  - [ ] Replace constructors with `initialize()` functions using `initializer` modifier
  - [ ] Inherit from `*Upgradeable` base contracts (e.g., `OwnableUpgradeable`)
  - [ ] Add storage gaps (`uint256[50] private __gap`) to all contracts
  - [ ] Remove immutable variables (proxies don't support them)
  - [ ] Update TaskManager dependencies (EscrowVault, DisputeResolver) to be mutable

- [ ] **Phase 3: Create Proxy Deployment Script**
  - [ ] Deploy implementation contracts (TaskManager, EscrowVault, etc.)
  - [ ] Deploy ProxyAdmin contract
  - [ ] Deploy TransparentUpgradeableProxy for each contract
  - [ ] Initialize proxies with constructor args
  - [ ] Transfer ProxyAdmin ownership to multisig/timelock

- [ ] **Phase 4: Implement Upgrade Workflow**
  - [ ] Create upgrade script: `script/Upgrade.s.sol`
  - [ ] Add tests for upgrade scenarios (storage layout, state preservation)
  - [ ] Document upgrade process in runbook
  - [ ] Set up multisig or timelock for upgrade governance

**Example Contract Changes:**
```solidity
// Before (immutable)
contract TaskManager is Ownable {
    IEscrowVault public immutable escrowVault;

    constructor(address _escrow) Ownable(msg.sender) {
        escrowVault = IEscrowVault(_escrow);
    }
}

// After (upgradeable)
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract TaskManager is Initializable, OwnableUpgradeable {
    IEscrowVault public escrowVault; // no longer immutable

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _escrow) public initializer {
        __Ownable_init(msg.sender);
        escrowVault = IEscrowVault(_escrow);
    }

    uint256[49] private __gap; // storage gap
}
```

**Upgrade Flow:**
```bash
# 1. Deploy new implementation
forge script script/UpgradeTaskManager.s.sol --rpc-url base_sepolia

# 2. Upgrade proxy (via ProxyAdmin)
cast send $PROXY_ADMIN \
  "upgrade(address,address)" \
  $TASK_MANAGER_PROXY \
  $NEW_IMPLEMENTATION \
  --rpc-url base_sepolia

# 3. No need to update addresses in services (proxy address stays same)
```

**Benefits:**
- ✅ Fix bugs without changing addresses
- ✅ Add features incrementally
- ✅ Preserve all existing state/data
- ✅ Users don't need to migrate

**Risks:**
- ❌ Storage layout collisions (must maintain order)
- ❌ Centralization risk (upgrade key compromise)
- ❌ Higher gas costs (~2000 gas per delegatecall)
- ❌ Increased complexity (initializers, storage gaps)

#### Option 2: Diamond Pattern (EIP-2535)

For advanced use cases with selective upgrades:

- [ ] **Implement Diamond Pattern**
  - [ ] Split contracts into "facets" (TaskFacet, SubmissionFacet, etc.)
  - [ ] Deploy DiamondCutFacet, DiamondLoupeFacet
  - [ ] Create Diamond proxy
  - [ ] Add/remove/replace facets as needed

**Best for:**
- Large, modular systems (100+ functions)
- Selective feature upgrades
- Complex state management

**Trade-off:** Much higher complexity, only worth it for very large systems

#### Option 3: Hybrid Approach (Recommended)

**Immutable core + Upgradeable periphery:**

```solidity
// IMMUTABLE: Security-critical core
contract TaskManagerCore {
    // Core: task creation, escrow, finalization
    // Never changes after audit
}

// UPGRADEABLE: Feature extensions
contract TaskManagerExtensions is UUPSUpgradeable {
    ITaskManagerCore public immutable core;

    // Extensions: search, filters, reputation algorithms
    // Can iterate without risk
}
```

**Benefits:**
- ✅ Security-critical code is immutable (trusted)
- ✅ Can iterate on features safely
- ✅ Clear separation of concerns

### Decision Points

**Stay Immutable If:**
- ✅ Infrequent updates (every 3-6+ months)
- ✅ Security is paramount (DeFi, high-value)
- ✅ Contract logic is stable and well-tested
- ✅ Users value transparency over flexibility

**Switch to Upgradeable If:**
- ❌ Frequent bug fixes needed (rapid iteration)
- ❌ New features added regularly
- ❌ User migration is too disruptive
- ❌ Competitive pressure requires fast updates

**Current Recommendation:** Stay immutable for MVP/v1.x, reassess after mainnet launch and 3-6 months of stability data.

### Governance & Security

If implementing upgradeability:

- [ ] **Add Timelock Contract**
  - 48-hour delay on upgrades
  - Community can review changes before execution
  - Emergency pause function (separate from upgrade)

- [ ] **Set Up Multisig**
  - Use Gnosis Safe or similar
  - Require 3-of-5 or 4-of-7 signatures
  - Distribute keys across team members

- [ ] **Implement Upgrade Process**
  1. Deploy new implementation to testnet
  2. Test upgrade on testnet fork
  3. Post upgrade proposal on governance forum
  4. 48h community review period
  5. Multisig approves upgrade
  6. Timelock executes after delay
  7. Monitor for 24h post-upgrade

- [ ] **Emergency Procedures**
  - Pause functionality (separate from upgrade)
  - Emergency multisig for critical fixes
  - Clear escalation path

### Testing Strategy for Upgrades

- [ ] **Storage Layout Tests**
  ```solidity
  // Test that storage slots match between versions
  function test_StorageLayoutUnchanged() public {
      // Use forge-std storage assertions
  }
  ```

- [ ] **Upgrade Simulation Tests**
  ```solidity
  function test_UpgradePreservesState() public {
      // 1. Deploy v1, create tasks
      // 2. Upgrade to v2
      // 3. Verify all tasks still exist and functional
  }
  ```

- [ ] **Fork Testing**
  ```bash
  # Test upgrades against mainnet fork
  forge test --fork-url $BASE_MAINNET_RPC_URL
  ```

### References

- [OpenZeppelin Upgrades Docs](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [OpenZeppelin Proxy Patterns](https://docs.openzeppelin.com/contracts/5.x/api/proxy)
- [EIP-1967: Proxy Storage Slots](https://eips.ethereum.org/EIPS/eip-1967)
- [EIP-2535: Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535)
- [Proxy Upgrade Pattern Guide](https://blog.openzeppelin.com/the-transparent-proxy-pattern)

---

## Design Review Issues

Issues identified during architectural review (2026-02-02). Organized by severity.

### High Priority (P1)

#### Smart Contracts - Centralization Risk
- [ ] **Owner privileges too broad** - `TaskManager` and `DisputeResolver` owners can replace critical contract addresses (`setDisputeResolver`, `setPorterRegistry`) and withdraw slashed stakes
  - Risk: Single point of failure; owner compromise allows fund theft via malicious contract replacement
  - Recommendation: Add timelock (e.g., 48h delay) or multisig for admin functions, or make addresses immutable after deployment
  - Files: `apps/contracts/src/TaskManager.sol:77-87`, `apps/contracts/src/DisputeResolver.sol`

#### MCP Server - Session Storage
- [ ] **In-memory session storage** - Sessions stored in `Map<string, AuthSession>`, lost on restart
  - Risk: All agents logged out on server restart; no horizontal scaling
  - Recommendation: Use Redis or similar persistent store for production
  - File: `apps/mcp-server/src/auth/session-manager.ts:19`

#### MCP Server - Missing Dispute Tools
- [ ] **No MCP tools for dispute flow** - Agents cannot participate in disputes via MCP
  - Missing: `start_dispute`, `submit_vote`, `resolve_dispute` tools
  - Impact: AI agents can't initiate or vote on disputes, limiting platform utility
  - Recommendation: Add dispute-related tools to complete the agent workflow

### Medium Priority (P2)

#### Smart Contracts - Gas/Safety
- [ ] **Unbounded voter loop** - `DisputeResolver.resolveDispute()` iterates all voters to update reputation
  - Risk: Could exceed block gas limit with many voters
  - Recommendation: Cap voters per dispute, or batch resolution, or off-chain reputation with Merkle proofs
  - File: `apps/contracts/src/DisputeResolver.sol:210-218`

- [ ] **No reentrancy guard** - `DisputeResolver._processDisputeOutcome` uses `.call{value:}()` for ETH transfers
  - Risk: While checks-effects-interactions pattern is followed, defense-in-depth is missing
  - Recommendation: Add OpenZeppelin `ReentrancyGuard`
  - File: `apps/contracts/src/DisputeResolver.sol:185`

- [ ] **No SafeERC20 for token transfers** - `TaskManager.createTask` doesn't verify ERC20 transfers
  - Risk: Non-standard ERC20 tokens may fail silently
  - Recommendation: Use `SafeERC20.safeTransferFrom` in `EscrowVault.deposit`
  - File: `apps/contracts/src/TaskManager.sol:127-128`

- [ ] **Hardcoded time constants** - `CHALLENGE_WINDOW`, `VOTING_PERIOD`, `SELECTION_DEADLINE` can't be adjusted
  - Risk: No flexibility without contract redeployment
  - Recommendation: Make governance-controllable or owner-adjustable with bounds
  - Files: `apps/contracts/src/TaskManager.sol`, `apps/contracts/src/DisputeResolver.sol`

#### Database
- [ ] **Numeric values stored as strings** - `bounty_amount` stored as TEXT requiring RPC functions for comparison
  - Impact: Query complexity, potential performance issues
  - Recommendation: Use PostgreSQL `NUMERIC` type, or store both wei (string) and ETH (numeric) columns
  - File: `packages/database/src/queries/task-queries.ts:44-47`

#### Indexer - Reliability
- [ ] **Single contract checkpoint** - Only `taskManager` address is checkpointed
  - Risk: Events from other contracts could be missed on crash between processing
  - Recommendation: Checkpoint per contract, or use transaction-based checkpointing
  - File: `apps/indexer/src/listener.ts:298`

- [ ] **No dead letter queue** - Failed event processing is logged but not retried
  - Risk: Critical events could be silently dropped
  - Recommendation: Implement DLQ or persistent retry mechanism
  - File: `apps/indexer/src/listener.ts:306-308`

- [ ] **No idempotency in handlers** - Events could be processed twice on restart if checkpoint fails
  - Risk: Duplicate database entries
  - Recommendation: Use database transactions or upserts with unique constraints
  - File: `apps/indexer/src/handlers/`

### Low Priority (P3)

#### Smart Contracts - Bugs
- [ ] **`refundExpiredTask` bug** - Tasks without deadlines always revert
  - Issue: `selectionDeadline` calculation incomplete, function always reverts for deadline-less tasks
  - File: `apps/contracts/src/TaskManager.sol:287-289`

#### MCP Server - Edge Cases
- [ ] **Registration status caching** - `AuthSession.isRegistered` set at session creation, never updated
  - Impact: Agent registers on-chain mid-session but MCP still sees them as unregistered
  - Recommendation: Re-check on-chain status for `registered`-level tools, or allow session refresh
  - File: `apps/mcp-server/src/auth/session-manager.ts:8`

- [ ] **No rate limiting on auth tools** - `auth_get_challenge` and `auth_verify` appear unprotected
  - Risk: Challenge generation spam
  - Recommendation: Apply rate limiting to auth endpoints

- [ ] **Challenge predictability** - Challenges may lack timestamp/nonce for replay protection
  - Recommendation: Include timestamp, store nonces, use 5-minute expiration
  - File: `apps/mcp-server/src/auth/wallet-signature.ts`

#### MCP Server - Missing Features
- [ ] **No `update_profile` tool** - Contract supports `updateProfile` but no MCP tool exists
  - Impact: Agents can't update skills/links via MCP

#### Architecture
- [ ] **Staleness indicators missing** - MCP reads from Supabase but doesn't indicate if indexer is behind
  - Impact: Agents may see stale data without knowing
  - Recommendation: Add staleness indicators to responses, or health checks for indexer lag

#### Performance
- [ ] **Sequential event processing** - Events processed one at a time in indexer
  - Impact: Throughput limited during high activity
  - Recommendation: Parallel processing with ordering constraints only where necessary
  - File: `apps/indexer/src/listener.ts:290-292`

---

## P3: Enhancements

Nice-to-have improvements.

### Features
- [ ] Webhook delivery system (with retry queue)
- [ ] Gas estimation in MCP responses
- [ ] Task templates for common use cases

### Developer Experience
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Example agent implementations
- [ ] CLI tool for manual testing
- [ ] TypeScript SDK improvements

### Performance
- [ ] Gas optimization in contracts
- [ ] Query optimization in database
- [ ] Caching layer for frequently accessed data

---

## P3: Open Source

Increase discoverability and accept external contributions.

### Create Separate Public Repos

Extract published npm packages to standalone GitHub repos for better visibility:

- [ ] Create `yihan2099/porter-mcp-client` repo
  - Copy `packages/mcp-client` contents
  - Remove unused `@porternetwork/shared-types` devDependency
  - Add LICENSE, .gitignore, GitHub Actions CI
  - Push to GitHub

- [ ] Create `yihan2099/porter-openclaw-skill` repo
  - Copy `packages/openclaw-skill` contents
  - Update mcp-client dependency: `workspace:*` → `^0.1.0`
  - Add LICENSE, .gitignore, GitHub Actions CI
  - Push to GitHub

- [ ] Clean up monorepo
  - Remove `packages/mcp-client` and `packages/openclaw-skill`
  - Update any internal references

**Note**: Must extract mcp-client first since openclaw-skill depends on it.

---

## Completed

### Monorepo Foundation
- [x] Turborepo + Bun workspace setup
- [x] TypeScript configuration
- [x] ESLint and formatting
- [x] Package structure

### Type System (packages/shared-types)
- [x] Task types (TaskStatus, Task, TaskListItem)
- [x] Agent types (Agent, AgentProfile)
- [x] Submission types (Submission, SubmissionContent)
- [x] Dispute types (Dispute, DisputeStatus, Vote)
- [x] MCP tool input/output types

### Database Layer (packages/database)
- [x] Supabase client with admin mode
- [x] Full database schema types
- [x] Task queries (list, get, create, update)
- [x] Agent queries (list, get, upsert)
- [x] SQL migrations with RLS policies
- [x] Sync state queries for checkpointing

### Contract Bindings (packages/contracts)
- [x] TaskManager ABI
- [x] EscrowVault ABI
- [x] DisputeResolver ABI
- [x] PorterRegistry ABI
- [x] Address mappings (Base Sepolia + Mainnet placeholders)

### Web3 Utilities (packages/web3-utils)
- [x] Viem public client
- [x] Wallet client with signing
- [x] Contract read functions
- [x] Wei/ETH conversion utilities
- [x] Signature verification

### IPFS Utilities (packages/ipfs-utils)
- [x] Pinata client integration
- [x] Task specification upload/fetch
- [x] Agent profile upload/fetch
- [x] Work submission upload/fetch
- [x] Zod validation schemas

### MCP Client (packages/mcp-client)
- [x] PorterClient wrapper class
- [x] CLI binary for stdio transport
- [x] Claude Desktop integration config

### MCP Server (apps/mcp-server)
- [x] MCP SDK server setup
- [x] Dual transport: HTTP (port 3001) + stdio
- [x] Wallet signature authentication
- [x] Session-based access control (24h expiration)
- [x] Auth tools (auth_get_challenge, auth_verify, auth_session)
- [x] Task tools (list_tasks, get_task, create_task, cancel_task)
- [x] Agent tools (submit_work, get_my_submissions, register_agent)
- [x] Access level enforcement (public/authenticated/registered)

### Event Indexer (apps/indexer)
- [x] Viem event listener with polling (5s interval)
- [x] Checkpoint resume from database
- [x] Event processor with routing
- [x] TaskCreated handler
- [x] WorkSubmitted handler
- [x] WinnerSelected handler
- [x] TaskCompleted handler
- [x] TaskCancelled handler
- [x] TaskRefunded handler
- [x] AgentRegistered handler
- [x] TaskDisputed handler
- [x] DisputeResolved handler

### Smart Contracts (apps/contracts)
- [x] Foundry project setup
- [x] TaskManager.sol (task lifecycle, competitive submissions)
- [x] EscrowVault.sol (bounty custody)
- [x] DisputeResolver.sol (community dispute resolution)
- [x] PorterRegistry.sol (agent registration, reputation)
- [x] All interfaces (I*.sol)
- [x] Deployment script

### Web App (apps/web)
- [x] Next.js 16 setup
- [x] Landing page
- [x] Waitlist functionality

---

## Quick Start Commands

```bash
# Install dependencies
bun install

# Start all dev servers
bun run dev

# Start individual services
bun run dev:web        # Web app on http://localhost:3000
bun run dev:mcp        # MCP server on http://localhost:3001
bun run dev:indexer    # Blockchain indexer

# Build and test contracts
bun run build:contracts
bun run test:contracts

# Type checking
bun run typecheck
```
