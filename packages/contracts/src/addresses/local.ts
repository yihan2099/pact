/**
 * Local Anvil chain addresses
 * These addresses are deterministic when deploying to a fresh Anvil instance
 */
export const LOCAL_CHAIN_ID = 31337 as const;

export const LOCAL_ADDRESSES = {
  porterRegistry: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as const,
  escrowVault: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as const,
  taskManager: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as const,
  verificationHub: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as const,
};
