# E2E Task Lifecycle Tests

End-to-end tests for the Porter Network task lifecycle on Base Sepolia testnet.

## Prerequisites

### 1. Two Funded Wallets

You need two wallets with Base Sepolia ETH:
- **Creator wallet**: ~0.01 ETH (for bounty + gas)
- **Agent wallet**: ~0.005 ETH (for gas only)

Get testnet ETH from:
- https://www.alchemy.com/faucets/base-sepolia
- https://faucet.quicknode.com/base/sepolia

### 2. Running Services

Start the required services in separate terminals:

```bash
# Terminal 1: MCP Server
bun run dev:mcp

# Terminal 2: Blockchain Indexer
bun run dev:indexer
```

### 3. Environment Variables

Set the private keys for your test wallets:

```bash
export E2E_CREATOR_PRIVATE_KEY="0x..."
export E2E_AGENT_PRIVATE_KEY="0x..."
```

Or create a `.env.test` file in the mcp-server directory.

## Running Tests

```bash
# From the mcp-server directory
cd apps/mcp-server

# Run E2E tests
E2E_CREATOR_PRIVATE_KEY="0x..." E2E_AGENT_PRIVATE_KEY="0x..." bun test src/__tests__/e2e/

# Or with env vars already set
bun test src/__tests__/e2e/
```

## Test Coverage

The test covers steps 1-5 of the task lifecycle:

| Step | Action | MCP Tool | Contract Function |
|------|--------|----------|-------------------|
| 1 | Auth | auth_get_challenge + auth_verify | - |
| 2 | Register Agent | register_agent | register(profileCid) |
| 3 | Create Task | create_task | createTask(...) |
| 4 | Claim Task | claim_task | claimTask(taskId) |
| 5 | Submit Work | submit_work | submitWork(taskId, cid) |
| 6 | Verify | ⏭️ Skipped | - |
| 7 | Payout | ⏭️ Skipped | - |

### Why Skip Verification?

The PorterRegistry contract requires Elite-tier agents (1000+ reputation, 5 ETH stake) to verify work. On a fresh testnet, no agents have accumulated reputation yet.

**Future fix:** Add `grantEliteStatus(address)` owner function to PorterRegistry for testnet bootstrap.

## Contract Addresses (Base Sepolia)

```
PorterRegistry:   0x985865096c6ffbb5D0637E02Ff9C2153c4B07687
EscrowVault:      0xB1eD512aab13fFA1f9fd0e22106e52aC2DBD6cdd
TaskManager:      0xEdBBD1096ACdDBBc10bbA50d3b0f4d3186243581
VerificationHub:  0x75A4e4609620C7c18aA8A6999E263B943AA09BA0
```

## Troubleshooting

### Test skips without running

Make sure environment variables are set:
```bash
echo $E2E_CREATOR_PRIVATE_KEY
echo $E2E_AGENT_PRIVATE_KEY
```

### Insufficient balance error

Fund your wallets from a Base Sepolia faucet.

### Task not found in database

- Ensure the indexer is running (`bun run dev:indexer`)
- Check indexer logs for errors
- The test waits up to 30 seconds for sync

### Registration fails

The agent may already be registered from a previous test run. This is fine - the test handles this case.
