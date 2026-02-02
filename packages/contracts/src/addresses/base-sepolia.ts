/**
 * Contract addresses on Base Sepolia testnet
 * Updated for competitive task system
 * Note: These addresses need to be updated after redeployment
 */
export const BASE_SEPOLIA_ADDRESSES = {
  taskManager: '0xEdBBD1096ACdDBBc10bbA50d3b0f4d3186243581' as `0x${string}`,
  escrowVault: '0xB1eD512aab13fFA1f9fd0e22106e52aC2DBD6cdd' as `0x${string}`,
  disputeResolver: '0x0000000000000000000000000000000000000000' as `0x${string}`, // TODO: Update after deployment
  porterRegistry: '0x985865096c6ffbb5D0637E02Ff9C2153c4B07687' as `0x${string}`,
} as const;

export const BASE_SEPOLIA_CHAIN_ID = 84532;
