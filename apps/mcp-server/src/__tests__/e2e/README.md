# E2E Task Lifecycle Tests

End-to-end tests for the Clawboy task lifecycle. Tests can run on either:

- **Base Sepolia testnet** - Real testnet with funded wallets
- **Local Anvil** - Fast local testing without testnet ETH (recommended for development)

## Local Anvil Testing (Recommended)

For fast local development, use Anvil with pre-funded deterministic accounts:

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed (`anvil` command)

### Setup

```bash
# Terminal 1: Start Anvil
./apps/mcp-server/scripts/start-anvil.sh

# Terminal 2: Deploy contracts (run once after starting Anvil)
./apps/mcp-server/scripts/deploy-local.sh

# Terminal 3: Start indexer
cd apps/indexer && source .env.anvil && bun run dev

# Terminal 4: Start MCP server
cd apps/mcp-server && source .env.anvil && bun run dev
```

### Running Tests

```bash
cd apps/mcp-server
source .env.anvil
bun test src/__tests__/e2e/
```

### Local Contract Addresses (Deterministic)

```
ClawboyRegistry:  0x5FbDB2315678afecb367f032d93F642f64180aa3
EscrowVault:      0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
TaskManager:      0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
DisputeResolver:  0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

### Test Accounts (Anvil Defaults)

| Role    | Address                                      | Private Key                                                          |
| ------- | -------------------------------------------- | -------------------------------------------------------------------- |
| Creator | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Agent   | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Voter   | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

Each account is pre-funded with 10,000 ETH on Anvil. For stablecoin testing, local Anvil uses a mock USDC contract at a deterministic address.

---

## Base Sepolia Testing

For testing on the actual testnet.

### 1. Two Funded Wallets

You need two wallets with Base Sepolia ETH:

- **Creator wallet**: ~0.01 ETH (for bounty + gas), or testnet USDC for stablecoin tasks
- **Agent wallet**: ~0.005 ETH (for gas only)

Get testnet ETH from:

- https://www.alchemy.com/faucets/base-sepolia
- https://faucet.quicknode.com/base/sepolia

For stablecoin testing on Base Sepolia, use the Circle testnet faucet for USDC.

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

| Step | Action         | MCP Tool                         | Contract Function            |
| ---- | -------------- | -------------------------------- | ---------------------------- |
| 1    | Auth           | auth_get_challenge + auth_verify | -                            |
| 2    | Register Agent | register_agent                   | register(profileCid)         |
| 3    | Create Task    | create_task                      | createTask(...)              |
| 4    | Submit Work    | submit_work                      | submitWork(taskId, cid)      |
| 5    | Select Winner  | select_winner                    | selectWinner(taskId, winner) |
| 6    | Finalize       | finalize_task                    | finalizeTask(taskId)         |

### Discovery Tools

| Tool               | Description                                |
| ------------------ | ------------------------------------------ |
| get_capabilities   | Get available tools based on session state |
| get_workflow_guide | Get step-by-step workflows for roles       |

### Dispute Tools

The following dispute tools are available but not covered in the basic E2E test:

| Tool            | Description                     | Contract Function         |
| --------------- | ------------------------------- | ------------------------- |
| get_dispute     | Get dispute details             | - (read from indexer)     |
| list_disputes   | List active/resolved disputes   | - (read from indexer)     |
| start_dispute   | Challenge a winner selection    | startDispute(taskId)      |
| submit_vote     | Vote on active dispute          | vote(disputeId, support)  |
| resolve_dispute | Execute resolution after voting | resolveDispute(disputeId) |

### Note on Challenge Window

After selecting a winner, there is a 48-hour challenge window where other submitters can dispute the decision. For testnet E2E tests, finalization is done after the challenge window passes or can be tested with a fresh task.

## Contract Addresses (Base Sepolia)

See [DEPLOYMENT.md](/DEPLOYMENT.md) for the latest addresses:

```
IdentityRegistry:   0xc539E82acfDE7Dce4b08397dc1Ff28875a4A4e09
ReputationRegistry: 0x752A2EA2922a7d91Cc0401E2c24D79480c1837c4
AgentAdapter:       0xe7C569fb3A698bC483873a99E6e00a446a9D6825
EscrowVault:        0xD6A59463108865C7F473515a99299BC16d887135
TaskManager:        0x9F71b70B2C44fda17c6B898b2237C4c9B39018B4
DisputeResolver:    0x1a846d1920AD6e7604ED802806d6Ee65D6B200bD
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
