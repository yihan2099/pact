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
    taskManager: '0xTaskManager' as `0x${string}`,
    escrowVault: '0xEscrowVault' as `0x${string}`,
    agentAdapter: '0xAgentAdapter' as `0x${string}`,
    identityRegistry: '0xIdentityRegistry' as `0x${string}`,
    reputationRegistry: '0xReputationRegistry' as `0x${string}`,
  })),
}));

const { getTaskManagerAddress, getTaskCount, getTask, contractStatusToTaskStatus } =
  await import('../../contracts/task-manager');

describe('task-manager contract', () => {
  beforeEach(() => {
    viemMock.reset();
    process.env.CHAIN_ID = '84532';
  });

  describe('getTaskManagerAddress', () => {
    test('returns task manager address', () => {
      const addr = getTaskManagerAddress();
      expect(addr).toBe('0xTaskManager');
    });

    test('accepts custom chainId', () => {
      const addr = getTaskManagerAddress(31337);
      expect(addr).toBe('0xTaskManager');
    });
  });

  describe('getTaskCount', () => {
    test('returns task count from contract', async () => {
      viemMock.setReadContractResult(5n);
      const count = await getTaskCount();
      expect(count).toBe(5n);
    });

    test('returns 0 when no tasks', async () => {
      viemMock.setReadContractResult(0n);
      const count = await getTaskCount();
      expect(count).toBe(0n);
    });

    test('accepts custom chainId', async () => {
      viemMock.setReadContractResult(3n);
      const count = await getTaskCount(31337);
      expect(count).toBe(3n);
    });
  });

  describe('getTask', () => {
    test('returns parsed task data', async () => {
      const taskTuple = [
        1n,
        '0xCreator',
        0,
        1000000000000000000n,
        '0x0000000000000000000000000000000000000000',
        'QmSpec123',
        100n,
        0n,
        '0x0000000000000000000000000000000000000000',
        0n,
        0n,
      ];
      viemMock.setReadContractResult(taskTuple);

      const task = await getTask(1n);
      expect(task.id).toBe(1n);
      expect(task.creator).toBe('0xCreator');
      expect(task.status).toBe(0);
      expect(task.bountyAmount).toBe(1000000000000000000n);
      expect(task.specificationCid).toBe('QmSpec123');
    });

    test('handles task with winner selected', async () => {
      const taskTuple = [
        2n,
        '0xCreator',
        1,
        500n,
        '0xToken',
        'QmSpec',
        50n,
        0n,
        '0xWinner',
        12345n,
        99999n,
      ];
      viemMock.setReadContractResult(taskTuple);

      const task = await getTask(2n);
      expect(task.selectedWinner).toBe('0xWinner');
      expect(task.selectedAt).toBe(12345n);
      expect(task.challengeDeadline).toBe(99999n);
    });
  });

  describe('contractStatusToTaskStatus', () => {
    test('maps 0 to open', () => {
      expect(contractStatusToTaskStatus(0)).toBe('open' as any);
    });

    test('maps 1 to in_review', () => {
      expect(contractStatusToTaskStatus(1)).toBe('in_review' as any);
    });

    test('maps 2 to completed', () => {
      expect(contractStatusToTaskStatus(2)).toBe('completed' as any);
    });

    test('maps 3 to disputed', () => {
      expect(contractStatusToTaskStatus(3)).toBe('disputed' as any);
    });

    test('maps 4 to refunded', () => {
      expect(contractStatusToTaskStatus(4)).toBe('refunded' as any);
    });

    test('maps 5 to cancelled', () => {
      expect(contractStatusToTaskStatus(5)).toBe('cancelled' as any);
    });

    test('defaults unknown status to open', () => {
      expect(contractStatusToTaskStatus(99)).toBe('open' as any);
    });
  });
});
