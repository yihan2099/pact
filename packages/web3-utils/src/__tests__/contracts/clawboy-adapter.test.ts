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
    agentAdapter: '0xAgentAdapter' as `0x${string}`,
    identityRegistry: '0xIdentityRegistry' as `0x${string}`,
    reputationRegistry: '0xReputationRegistry' as `0x${string}`,
    taskManager: '0xTaskManager' as `0x${string}`,
    escrowVault: '0xEscrowVault' as `0x${string}`,
  })),
}));

const {
  isAgentRegistered,
  getAgentId,
  getAgentVoteWeight,
  getAgentReputationSummary,
  getAgentAdapterAddress,
} = await import('../../contracts/clawboy-adapter');

describe('clawboy-adapter contract', () => {
  beforeEach(() => {
    viemMock.reset();
    process.env.CHAIN_ID = '84532';
  });

  describe('getAgentAdapterAddress', () => {
    test('returns agent adapter address', () => {
      const addr = getAgentAdapterAddress();
      expect(addr).toBe('0xAgentAdapter');
    });
  });

  describe('isAgentRegistered', () => {
    test('returns true for registered agent', async () => {
      viemMock.setReadContractResult(true);
      const result = await isAgentRegistered(
        '0x1234567890123456789012345678901234567890' as `0x${string}`
      );
      expect(result).toBe(true);
    });

    test('returns false for unregistered agent', async () => {
      viemMock.setReadContractResult(false);
      const result = await isAgentRegistered(
        '0x1234567890123456789012345678901234567890' as `0x${string}`
      );
      expect(result).toBe(false);
    });

    test('calls readContract with correct args', async () => {
      viemMock.setReadContractResult(false);
      const addr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
      await isAgentRegistered(addr);
      expect(viemMock.mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'isRegistered',
          args: [addr],
        })
      );
    });
  });

  describe('getAgentId', () => {
    test('returns agent ID', async () => {
      viemMock.setReadContractResult(42n);
      const id = await getAgentId('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`);
      expect(id).toBe(42n);
    });

    test('returns 0 for unregistered agent', async () => {
      viemMock.setReadContractResult(0n);
      const id = await getAgentId('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`);
      expect(id).toBe(0n);
    });
  });

  describe('getAgentVoteWeight', () => {
    test('returns vote weight', async () => {
      viemMock.setReadContractResult(5n);
      const weight = await getAgentVoteWeight(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`
      );
      expect(weight).toBe(5n);
    });

    test('calls readContract with getVoteWeight', async () => {
      viemMock.setReadContractResult(1n);
      const addr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
      await getAgentVoteWeight(addr);
      expect(viemMock.mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'getVoteWeight',
          args: [addr],
        })
      );
    });
  });

  describe('getAgentReputationSummary', () => {
    test('returns parsed reputation summary', async () => {
      viemMock.setReadContractResult([10n, 3n, 1n, 100n]);
      const summary = await getAgentReputationSummary(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`
      );
      expect(summary.taskWins).toBe(10n);
      expect(summary.disputeWins).toBe(3n);
      expect(summary.disputeLosses).toBe(1n);
      expect(summary.totalReputation).toBe(100n);
    });
  });
});
