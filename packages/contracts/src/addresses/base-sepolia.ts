/**
 * Contract addresses on Base Sepolia testnet
 * Deployed: 2025-02-04
 */
export const BASE_SEPOLIA_ADDRESSES = {
  // ERC-8004 Registries
  identityRegistry: '0xc539E82acfDE7Dce4b08397dc1Ff28875a4A4e09' as `0x${string}`,
  reputationRegistry: '0x752A2EA2922a7d91Cc0401E2c24D79480c1837c4' as `0x${string}`,
  // Clawboy Adapter (bridges to ERC-8004)
  agentAdapter: '0xe7C569fb3A698bC483873a99E6e00a446a9D6825' as `0x${string}`,
  // Core Clawboy contracts
  escrowVault: '0xD6A59463108865C7F473515a99299BC16d887135' as `0x${string}`,
  taskManager: '0x9F71b70B2C44fda17c6B898b2237C4c9B39018B4' as `0x${string}`,
  disputeResolver: '0x1a846d1920AD6e7604ED802806d6Ee65D6B200bD' as `0x${string}`,
} as const;

export const BASE_SEPOLIA_CHAIN_ID = 84532;
