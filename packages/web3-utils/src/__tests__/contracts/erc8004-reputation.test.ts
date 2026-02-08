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
    reputationRegistry: '0xReputationRegistry' as `0x${string}`,
    identityRegistry: '0xIdentityRegistry' as `0x${string}`,
    agentAdapter: '0xAgentAdapter' as `0x${string}`,
    taskManager: '0xTaskManager' as `0x${string}`,
    escrowVault: '0xEscrowVault' as `0x${string}`,
  })),
}));

const {
  getFeedbackSummary,
  getFeedbackClients,
  getLastFeedbackIndex,
  readFeedback,
  getFeedbackCount,
} = await import('../../contracts/erc8004-reputation');

describe('erc8004-reputation contract', () => {
  beforeEach(() => {
    viemMock.reset();
    process.env.CHAIN_ID = '84532';
  });

  describe('getFeedbackSummary', () => {
    test('returns parsed feedback summary', async () => {
      viemMock.setReadContractResult([5n, 100n, 0]);
      const result = await getFeedbackSummary(1n, 'task', 'win');
      expect(result.count).toBe(5n);
      expect(result.summaryValue).toBe(100n);
      expect(result.summaryValueDecimals).toBe(0);
    });

    test('passes tags and client addresses', async () => {
      viemMock.setReadContractResult([0n, 0n, 0]);
      const clients = ['0xaaa' as `0x${string}`];
      await getFeedbackSummary(1n, 'dispute', 'loss', clients);
      expect(viemMock.mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'getSummary',
          args: [1n, clients, 'dispute', 'loss'],
        })
      );
    });
  });

  describe('getFeedbackClients', () => {
    test('returns list of client addresses', async () => {
      const clients = ['0xaaa', '0xbbb'] as `0x${string}`[];
      viemMock.setReadContractResult(clients);
      const result = await getFeedbackClients(1n);
      expect(result).toEqual(clients);
    });

    test('returns empty array when no clients', async () => {
      viemMock.setReadContractResult([]);
      const result = await getFeedbackClients(1n);
      expect(result).toEqual([]);
    });
  });

  describe('getLastFeedbackIndex', () => {
    test('returns last feedback index', async () => {
      viemMock.setReadContractResult(3n);
      const result = await getLastFeedbackIndex(1n, '0xaaa' as `0x${string}`);
      expect(result).toBe(3n);
    });
  });

  describe('readFeedback', () => {
    test('returns parsed feedback entry', async () => {
      viemMock.setReadContractResult([10n, 0, 'task', 'win', false]);
      const result = await readFeedback(1n, '0xaaa' as `0x${string}`, 1n);
      expect(result.value).toBe(10n);
      expect(result.valueDecimals).toBe(0);
      expect(result.tag1).toBe('task');
      expect(result.tag2).toBe('win');
      expect(result.isRevoked).toBe(false);
    });

    test('handles revoked feedback', async () => {
      viemMock.setReadContractResult([5n, 0, 'task', 'win', true]);
      const result = await readFeedback(1n, '0xaaa' as `0x${string}`, 2n);
      expect(result.isRevoked).toBe(true);
    });
  });

  describe('getFeedbackCount', () => {
    test('returns feedback count for tags', async () => {
      viemMock.setReadContractResult(7n);
      const result = await getFeedbackCount(1n, 'task', 'win');
      expect(result).toBe(7n);
    });

    test('calls with correct function name', async () => {
      viemMock.setReadContractResult(0n);
      await getFeedbackCount(2n, 'dispute', 'loss');
      expect(viemMock.mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'getFeedbackCount',
          args: [2n, 'dispute', 'loss'],
        })
      );
    });
  });
});
