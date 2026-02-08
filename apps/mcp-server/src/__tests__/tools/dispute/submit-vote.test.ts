import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createWeb3UtilsMock, createContractsMock } from '../../helpers/mock-deps';

const web3Mock = createWeb3UtilsMock();
const contractsMock = createContractsMock();

const mockReadContract = mock();
web3Mock.getPublicClient.mockReturnValue({ readContract: mockReadContract });

mock.module('@clawboy/web3-utils', () => web3Mock);

mock.module('@clawboy/contracts', () => ({
  ...contractsMock,
  getContractAddresses: () => ({
    taskManager: '0xTaskManager',
    disputeResolver: '0xDisputeResolver',
  }),
}));

mock.module('../../../config/chain', () => ({
  getChainId: () => 84532,
}));

import { submitVoteTool } from '../../../tools/dispute/submit-vote';

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
  isAuthenticated: true,
  isRegistered: true,
  sessionId: 'session-1',
};

// Future timestamp for voting deadline
const futureDeadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 86400);

describe('submit_vote tool', () => {
  beforeEach(() => {
    mockReadContract.mockReset();
    web3Mock.getAgentVoteWeight.mockReset();
    web3Mock.getAgentVoteWeight.mockResolvedValue(5n);
  });

  function setupMocks(
    overrides: {
      disputeStatus?: number;
      votingDeadline?: bigint;
      disputer?: string;
      taskCreator?: string;
      hasVoted?: boolean;
    } = {}
  ) {
    const {
      disputeStatus = 0, // Active
      votingDeadline = futureDeadline,
      disputer = '0x1111111111111111111111111111111111111111',
      taskCreator = '0x2222222222222222222222222222222222222222',
      hasVoted = false,
    } = overrides;

    mockReadContract
      // getDispute
      .mockResolvedValueOnce([
        1n, // id
        1n, // taskId
        disputer, // disputer
        10000000000000000n, // disputeStake
        votingDeadline,
        disputeStatus, // status
        false, // disputerWon
        10n, // votesForDisputer
        5n, // votesAgainstDisputer
      ])
      // getTask (for creator check)
      .mockResolvedValueOnce([
        1n, // id
        taskCreator, // creator
      ])
      // hasVoted
      .mockResolvedValueOnce(hasVoted);
  }

  test('should prepare vote for valid voter', async () => {
    setupMocks();

    const result = await submitVoteTool.handler(
      { disputeId: '1', supportsDisputer: true },
      context
    );

    expect(result.message).toContain('Ready to submit vote');
    expect(result.disputeId).toBe('1');
    expect(result.supportsDisputer).toBe(true);
    expect(result.yourVoteWeight).toBe('5');
    expect(result.contractAddress).toBe('0xDisputeResolver');
  });

  test('should throw when dispute not found', async () => {
    mockReadContract.mockResolvedValueOnce([0n, 0n, '0x0', 0n, 0n, 0, false, 0n, 0n]);

    await expect(
      submitVoteTool.handler({ disputeId: '99', supportsDisputer: true }, context)
    ).rejects.toThrow('Dispute not found');
  });

  test('should throw when dispute is not active', async () => {
    setupMocks({ disputeStatus: 1 }); // Resolved

    await expect(
      submitVoteTool.handler({ disputeId: '1', supportsDisputer: true }, context)
    ).rejects.toThrow('Dispute is not active');
  });

  test('should throw when voting period has ended', async () => {
    setupMocks({ votingDeadline: pastDeadline });

    await expect(
      submitVoteTool.handler({ disputeId: '1', supportsDisputer: true }, context)
    ).rejects.toThrow('Voting period has ended');
  });

  test('should throw when caller is the disputer', async () => {
    setupMocks({ disputer: context.callerAddress });

    await expect(
      submitVoteTool.handler({ disputeId: '1', supportsDisputer: true }, context)
    ).rejects.toThrow('Disputer cannot vote');
  });

  test('should throw when caller is the task creator', async () => {
    setupMocks({ taskCreator: context.callerAddress });

    await expect(
      submitVoteTool.handler({ disputeId: '1', supportsDisputer: true }, context)
    ).rejects.toThrow('Task creator cannot vote');
  });

  test('should throw when caller has already voted', async () => {
    setupMocks({ hasVoted: true });

    await expect(
      submitVoteTool.handler({ disputeId: '1', supportsDisputer: true }, context)
    ).rejects.toThrow('already voted');
  });

  test('should indicate vote position in response', async () => {
    setupMocks();

    const result = await submitVoteTool.handler(
      { disputeId: '1', supportsDisputer: false },
      context
    );

    expect(result.votePosition).toBe('AGAINST disputer');
  });
});
