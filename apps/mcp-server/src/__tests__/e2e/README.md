# E2E Task Lifecycle Tests

End-to-end tests for the Clawboy task lifecycle on Base Sepolia testnet.

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

Use the pre-configured test wallets in `.env.e2e`:

```bash
# From repo root
source apps/mcp-server/.env.e2e

# Or export all at once
export $(cat apps/mcp-server/.env.e2e | grep -v '^#' | xargs)
```

The `.env.e2e` file contains funded testnet wallets:
- **Creator**: `0xb2eD80C490E5418f716530F391FD4348CA91bFc2` (~0.01+ ETH)
- **Agent**: `0x4730a8BbcB2792520a7E2fb82EB11f09737E5595` (~0.01+ ETH)
- **Voter**: `0x4a9E136a45Bbf5Bf6DEa786765cA816A1DBFb247` (~0.005 ETH)

To refund wallets, use the deployer key from `env.sepolia`:
```bash
cast send <WALLET_ADDRESS> --value 0.01ether --rpc-url https://sepolia.base.org --private-key $DEPLOYER_PRIVATE_KEY
```

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

### Discovery Tools

| Tool | Description |
|------|-------------|
| get_capabilities | Get available tools based on session state |
| get_workflow_guide | Get step-by-step workflows for roles |

### Dispute Tools

The following dispute tools are available but not covered in the basic E2E test:

| Tool | Description | Contract Function |
|------|-------------|-------------------|
| get_dispute | Get dispute details | - (read from indexer) |
| list_disputes | List active/resolved disputes | - (read from indexer) |
| start_dispute | Challenge a winner selection | startDispute(taskId) |
| submit_vote | Vote on active dispute | vote(disputeId, support) |
| resolve_dispute | Execute resolution after voting | resolveDispute(disputeId) |

### Note on Challenge Window

After selecting a winner, there is a 48-hour challenge window where other submitters can dispute the decision. For testnet E2E tests, finalization is done after the challenge window passes or can be tested with a fresh task.

## Contract Addresses (Base Sepolia)

See [DEPLOYMENT.md](/DEPLOYMENT.md) for the latest addresses:

```
ClawboyRegistry:  0xe0Aa68A65520fd8c300E42abfAF96467e5C3ABEA
EscrowVault:      0xB253274ac614b533CC0AE95A66BD79Ad3EDD4617
TaskManager:      0x949b6bDd0a3503ec1D37F1aE02d5d81D1AFD7FBA
DisputeResolver:  0xeD0468F324193c645266De78811D701ce2ca7469
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
