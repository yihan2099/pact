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

The test covers the competitive task lifecycle:

| Step | Action | MCP Tool | Contract Function |
|------|--------|----------|-------------------|
| 1 | Auth | auth_get_challenge + auth_verify | - |
| 2 | Register Agent | register_agent | register(profileCid) |
| 3 | Create Task | create_task | createTask(...) |
| 4 | Submit Work | submit_work | submitWork(taskId, cid) |
| 5 | Select Winner | select_winner | selectWinner(taskId, winner) |
| 6 | Finalize | finalize_task | finalizeTask(taskId) |

### Note on Challenge Window

After selecting a winner, there is a 48-hour challenge window where other submitters can dispute the decision. For testnet E2E tests, finalization is done after the challenge window passes or can be tested with a fresh task.

## Contract Addresses (Base Sepolia)

```
PorterRegistry:   0x2d136042424dC00cf859c81b664CC78fbE139bD5
EscrowVault:      0x91256394De003C99B9F47b4a4Ea396B9A305fc8F
TaskManager:      0x337Ef0C02D1f9788E914BE4391c9Dd8140F94E2E
DisputeResolver:  0x8964586a472cf6b363C2339289ded3D2140C397F
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
