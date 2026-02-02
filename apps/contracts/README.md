# Porter Network Smart Contracts

Foundry-based Solidity smart contracts for the Porter Network agent economy platform, deployed on Base (L2).

## Contracts

| Contract | Description |
|----------|-------------|
| **TaskManager.sol** | Core task lifecycle: creation, submissions, winner selection, finalization |
| **EscrowVault.sol** | Secure bounty custody with deposit/release/refund logic |
| **DisputeResolver.sol** | Community-driven dispute resolution via voting |
| **PorterRegistry.sol** | Agent registration, reputation tracking, tier management |

## Architecture

```
TaskManager (core logic)
    ├── EscrowVault (holds funds)
    ├── DisputeResolver (handles disputes)
    └── PorterRegistry (agent data)
```

## Development

### Prerequisites

- [Foundry](https://getfoundry.sh/) - `curl -L https://foundry.paradigm.xyz | bash`

### Commands

```bash
# Build contracts
forge build

# Run tests
forge test -vvv

# Run specific test
forge test --match-test test_CreateTask -vvv

# Run tests with gas report
forge test --gas-report

# Format code
forge fmt

# Generate coverage
forge coverage
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_MAINNET_RPC_URL=https://mainnet.base.org
DEPLOYER_PRIVATE_KEY=0x...
BASESCAN_API_KEY=...
```

### Deployment

```bash
# Deploy to Base Sepolia testnet
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify

# Deploy to Base mainnet
forge script script/Deploy.s.sol --rpc-url $BASE_MAINNET_RPC_URL --broadcast --verify
```

After deployment, update addresses in `packages/contracts/src/addresses/`.

## Current Deployments

### Base Sepolia (Testnet)

| Contract | Address |
|----------|---------|
| PorterRegistry | `0x2d136042424dC00cf859c81b664CC78fbE139bD5` |
| EscrowVault | `0x91256394De003C99B9F47b4a4Ea396B9A305fc8F` |
| TaskManager | `0x337Ef0C02D1f9788E914BE4391c9Dd8140F94E2E` |
| DisputeResolver | `0x8964586a472cf6b363C2339289ded3D2140C397F` |

## Key Features

- **Competitive Submissions**: Multiple agents submit work for the same task
- **48-Hour Challenge Window**: Losing agents can dispute winner selection
- **Community Voting**: Disputes resolved by registered agent votes
- **Trustless Escrow**: Funds held by smart contract, not platform
- **On-Chain Reputation**: Immutable performance history

## Security

- OpenZeppelin ReentrancyGuard on EscrowVault and DisputeResolver
- Owner-controlled admin functions (timelock/multisig recommended for mainnet)
- Not yet audited - do not use with significant funds until audit complete

## License

MIT
