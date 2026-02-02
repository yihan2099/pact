# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. **Create a private security advisory** on GitHub: https://github.com/yihan2099/porternetwork/security/advisories/new
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours of your report
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity, typically 30-90 days
- **Credit**: We'll credit you in the fix announcement (unless you prefer anonymity)

### Scope

The following are in scope for security reports:

- Smart contracts in `apps/contracts/`
- MCP server authentication and authorization (`apps/mcp-server/`)
- Blockchain indexer event handling (`apps/indexer/`)
- Web3 utility functions (`packages/web3-utils/`)

### Out of Scope

- Third-party dependencies (report to upstream maintainers)
- Issues already documented in TODO.md
- Theoretical attacks without proof of concept
- Social engineering attacks

## Known Limitations

The following issues are documented and tracked in our TODO.md:

### Smart Contracts

1. **Unbounded voter loop** - `DisputeResolver.resolveDispute()` iterates all voters to update reputation. Could exceed block gas limit with many voters.
   - Mitigation: Monitor voter counts, plan to implement batched resolution

2. **Owner privileges** - Contract owners can replace critical contract addresses
   - Mitigation: Planned timelock or multisig for admin functions before mainnet

3. **Hardcoded time constants** - Challenge window and voting periods cannot be adjusted without redeployment
   - Impact: Limited operational flexibility

4. **No SafeERC20** - Token transfers don't use SafeERC20 library
   - Impact: Non-standard ERC20 tokens may not work correctly

### Infrastructure

5. **In-memory fallback** - Session and challenge storage falls back to in-memory when Redis is unavailable
   - Impact: Data loss on server restart if Redis is down

## Security Measures Implemented

- OpenZeppelin ReentrancyGuard on EscrowVault and DisputeResolver
- Rate limiting on all API endpoints (fails closed when Redis unavailable)
- Wallet signature authentication with challenge-response
- Session-based access control with 24h expiration
- CORS restrictions with configurable origins
- Security headers (CSP, X-Frame-Options, HSTS)
- Input validation with length limits
- Challenge nonces prevent replay attacks
- Timestamp freshness validation (5-minute window)

## Audit Status

**Status: Not yet audited**

The smart contracts have not undergone a formal security audit. An external audit is planned before mainnet deployment. Use at your own risk on testnet.

## Bug Bounty

We do not currently have a formal bug bounty program. However, we deeply appreciate responsible disclosure and will:

- Credit reporters publicly (with permission)
- Consider rewards for critical vulnerabilities on a case-by-case basis

## Contact

- Security issues: [GitHub Security Advisories](https://github.com/yihan2099/porternetwork/security/advisories/new)
- General questions: Open a GitHub issue or discussion
