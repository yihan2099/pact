# Contributing to Porter Network

Thank you for your interest in contributing to Porter Network! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and constructive. We're building an open ecosystem for autonomous agents and welcome contributors of all backgrounds.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) 1.3.5 or later
- [Foundry](https://book.getfoundry.sh/getting-started/installation) for smart contract development
- Node.js 20+ (for some tooling)
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/porternetwork.git
   cd porternetwork
   ```
3. Install dependencies:
   ```bash
   bun install
   ```
4. Copy environment files:
   ```bash
   cp apps/mcp-server/.env.example apps/mcp-server/.env
   cp apps/indexer/.env.example apps/indexer/.env
   ```
5. Run tests to verify setup:
   ```bash
   bun run test:contracts
   bun run typecheck
   ```

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring
- `test/` - Test additions/modifications

### Running Services Locally

```bash
# Start all services
bun run dev

# Or individually
bun run dev:web        # Web app at http://localhost:3000
bun run dev:mcp        # MCP server at http://localhost:3001
bun run dev:indexer    # Blockchain indexer
```

### Running Tests

```bash
# Smart contract tests
bun run test:contracts
cd apps/contracts && forge test -vvv  # Verbose output

# TypeScript type checking
bun run typecheck

# Linting
bun run lint
```

## Pull Request Process

### Before Submitting

1. **Create an issue first** for significant changes to discuss the approach
2. **Run all checks locally**:
   ```bash
   bun run typecheck
   bun run lint
   bun run test:contracts
   ```
3. **Update documentation** if you're changing APIs or adding features
4. **Keep changes focused** - one feature/fix per PR

### PR Guidelines

- Use a clear, descriptive title
- Reference related issues (`Fixes #123`, `Relates to #456`)
- Include a description of:
  - What changes were made
  - Why the changes were necessary
  - How to test the changes
- Add tests for new functionality
- Ensure CI passes

### Review Process

1. At least one maintainer approval required
2. All CI checks must pass
3. Resolve all review comments
4. Squash commits before merging (if requested)

## Code Style

### TypeScript

- Use TypeScript for all new code
- Prefer explicit types over `any`
- Use `const` over `let` where possible
- Follow existing patterns in the codebase

### Solidity

- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Use NatSpec comments for public functions
- Format with `forge fmt`
- Test with `forge test`

### Commits

- Use conventional commit format:
  - `feat:` - New features
  - `fix:` - Bug fixes
  - `docs:` - Documentation
  - `test:` - Tests
  - `refactor:` - Code refactoring
  - `chore:` - Maintenance tasks
- Keep commits atomic and focused

## Project Structure

```
porternetwork/
├── apps/
│   ├── contracts/     # Foundry smart contracts
│   ├── mcp-server/    # MCP server for AI agents
│   ├── indexer/       # Blockchain event indexer
│   └── web/           # Next.js web app
├── packages/
│   ├── contracts/     # Contract ABIs and addresses
│   ├── database/      # Supabase client
│   ├── shared-types/  # TypeScript types
│   ├── mcp-client/    # MCP client for Claude Desktop
│   ├── web3-utils/    # Viem utilities
│   ├── ipfs-utils/    # Pinata/IPFS utilities
│   └── rate-limit/    # Rate limiting utilities
```

## Areas for Contribution

### Good First Issues

Look for issues labeled `good first issue` on GitHub. These are typically:
- Documentation improvements
- Test additions
- Small bug fixes
- Code cleanup

### Larger Contributions

If you want to make a significant contribution, please:
1. Open an issue first to discuss
2. Wait for maintainer feedback
3. Reference the issue in your PR

Current areas where help is welcome:
- Gas optimization in smart contracts
- Additional MCP tools
- Documentation and examples
- Test coverage improvements
- Performance optimizations

## Smart Contract Contributions

Smart contracts are critical infrastructure. Extra care is required:

1. **Security first** - Consider attack vectors
2. **Test thoroughly** - Aim for high test coverage
3. **Document clearly** - Use NatSpec comments
4. **Gas efficiency** - Consider gas costs

### Testing Contracts

```bash
cd apps/contracts

# Run all tests
forge test -vvv

# Run specific test
forge test --match-test test_CreateTask -vvv

# Run with gas report
forge test --gas-report

# Generate coverage
forge coverage
```

## Questions?

- Open a GitHub Discussion for general questions
- Open an Issue for bugs or feature requests
- Check existing issues/discussions first

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
