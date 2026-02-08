import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { setupViemMock } from '../helpers/mock-viem';

const viemMock = setupViemMock();

mock.module('@clawboy/contracts', () => ({
  TaskManagerABI: [],
  EscrowVaultABI: [],
  ClawboyAgentAdapterABI: [],
  ERC8004IdentityRegistryABI: [],
  ERC8004ReputationRegistryABI: [],
  DisputeResolverABI: [],
  getContractAddresses: mock(() => ({
    escrowVault: '0xEscrowVault' as `0x${string}`,
    taskManager: '0xTaskManager' as `0x${string}`,
    agentAdapter: '0xAgentAdapter' as `0x${string}`,
    identityRegistry: '0xIdentityRegistry' as `0x${string}`,
    reputationRegistry: '0xReputationRegistry' as `0x${string}`,
  })),
}));

const { getEscrowVaultAddress, getEscrowBalance } = await import('../../contracts/escrow-vault');

describe('escrow-vault contract', () => {
  beforeEach(() => {
    viemMock.reset();
    process.env.CHAIN_ID = '84532';
  });

  describe('getEscrowVaultAddress', () => {
    test('returns escrow vault address', () => {
      const addr = getEscrowVaultAddress();
      expect(addr).toBe('0xEscrowVault');
    });

    test('accepts custom chainId', () => {
      const addr = getEscrowVaultAddress(31337);
      expect(addr).toBe('0xEscrowVault');
    });
  });

  describe('getEscrowBalance', () => {
    test('returns parsed balance with token and amount', async () => {
      viemMock.setReadContractResult([
        '0x0000000000000000000000000000000000000000',
        1000000000000000000n,
      ]);
      const result = await getEscrowBalance(1n);
      expect(result.token).toBe('0x0000000000000000000000000000000000000000');
      expect(result.amount).toBe(1000000000000000000n);
    });

    test('returns zero balance for unfunded task', async () => {
      viemMock.setReadContractResult(['0x0000000000000000000000000000000000000000', 0n]);
      const result = await getEscrowBalance(999n);
      expect(result.amount).toBe(0n);
    });

    test('calls readContract with getBalance', async () => {
      viemMock.setReadContractResult(['0x0000000000000000000000000000000000000000', 0n]);
      await getEscrowBalance(5n);
      expect(viemMock.mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'getBalance',
          args: [5n],
        })
      );
    });

    test('works with ERC20 token balance', async () => {
      viemMock.setReadContractResult(['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 500000000n]);
      const result = await getEscrowBalance(10n);
      expect(result.token).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
      expect(result.amount).toBe(500000000n);
    });
  });
});
