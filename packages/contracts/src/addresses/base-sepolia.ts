/**
 * Contract addresses on Base Sepolia testnet
 * Deployed with competitive task system (selectWinner, CHALLENGE_WINDOW, disputes)
 * Deployed: 2025-02-02
 */
export const BASE_SEPOLIA_ADDRESSES = {
  taskManager: '0x337Ef0C02D1f9788E914BE4391c9Dd8140F94E2E' as `0x${string}`,
  escrowVault: '0x91256394De003C99B9F47b4a4Ea396B9A305fc8F' as `0x${string}`,
  disputeResolver: '0x8964586a472cf6b363C2339289ded3D2140C397F' as `0x${string}`,
  clawboyRegistry: '0x2d136042424dC00cf859c81b664CC78fbE139bD5' as `0x${string}`,
} as const;

export const BASE_SEPOLIA_CHAIN_ID = 84532;
