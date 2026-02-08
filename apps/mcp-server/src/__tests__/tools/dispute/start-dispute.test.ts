import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createWeb3UtilsMock, createContractsMock } from '../../helpers/mock-deps';

const web3Mock = createWeb3UtilsMock();
const contractsMock = createContractsMock();

const mockReadContract = mock();
web3Mock.getPublicClient.mockReturnValue({ readContract: mockReadContract });

mock.module('@clawboy/web3-utils', () => web3Mock);
mock.module('@clawboy/contracts', () => contractsMock);

mock.module('../../../config/chain', () => ({
  getChainId: () => 84532,
}));

// Must also mock viem's formatEther
mock.module('viem', () => ({
  formatEther: (val: bigint) => (Number(val) / 1e18).toString(),
}));

import { startDisputeTool } from '../../../tools/dispute/start-dispute';

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
  isAuthenticated: true,
  isRegistered: true,
  sessionId: 'session-1',
};

describe('start_dispute tool', () => {
  beforeEach(() => {
    mockReadContract.mockReset();
  });

  function setupMocks(
    overrides: {
      status?: number;
      bountyAmount?: bigint;
      hasSubmitted?: boolean;
      existingDisputeId?: bigint;
      minStake?: bigint;
      votingPeriod?: bigint;
    } = {}
  ) {
    const {
      status = 1, // InReview
      bountyAmount = 1000000000000000000n, // 1 ETH
      hasSubmitted = true,
      existingDisputeId = 0n,
      minStake = 10000000000000000n, // 0.01 ETH
      votingPeriod = 172800n, // 48 hours
    } = overrides;

    mockReadContract
      .mockResolvedValueOnce([0n, '0xCreator', status, bountyAmount]) // getTask
      .mockResolvedValueOnce(hasSubmitted) // hasSubmitted
      .mockResolvedValueOnce(existingDisputeId) // getDisputeByTask
      .mockResolvedValueOnce(minStake) // MIN_DISPUTE_STAKE
      .mockResolvedValueOnce(votingPeriod); // votingPeriod
  }

  test('should prepare dispute for valid submitter on in-review task', async () => {
    setupMocks();

    const result = await startDisputeTool.handler({ taskId: '1' }, context);

    expect(result.message).toContain('Ready to start dispute');
    expect(result.taskId).toBe('1');
    expect(result.contractAddress).toBe('0xDisputeResolver');
    expect(result.requiredStakeWei).toBeDefined();
    expect(result.votingPeriodSeconds).toBe(172800);
  });

  test('should throw when task is not in review', async () => {
    setupMocks({ status: 0 }); // Open, not InReview

    await expect(startDisputeTool.handler({ taskId: '1' }, context)).rejects.toThrow(
      'Task must be in review status'
    );
  });

  test('should throw when caller has not submitted', async () => {
    mockReadContract
      .mockResolvedValueOnce([0n, '0xCreator', 1, 1000000000000000000n])
      .mockResolvedValueOnce(false); // hasSubmitted = false

    await expect(startDisputeTool.handler({ taskId: '1' }, context)).rejects.toThrow(
      'Only submitters'
    );
  });

  test('should throw when dispute already exists', async () => {
    mockReadContract
      .mockResolvedValueOnce([0n, '0xCreator', 1, 1000000000000000000n])
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(42n); // existing dispute

    await expect(startDisputeTool.handler({ taskId: '1' }, context)).rejects.toThrow(
      'dispute already exists'
    );
  });

  test('should use minStake when 1% of bounty is lower', async () => {
    setupMocks({
      bountyAmount: 100000000000000n, // tiny bounty
      minStake: 10000000000000000n, // larger min stake
    });

    const result = await startDisputeTool.handler({ taskId: '1' }, context);

    expect(BigInt(result.requiredStakeWei)).toBe(10000000000000000n);
  });

  test('should use 1% of bounty when higher than minStake', async () => {
    setupMocks({
      bountyAmount: 100000000000000000000n, // 100 ETH
      minStake: 10000000000000000n, // 0.01 ETH
    });

    const result = await startDisputeTool.handler({ taskId: '1' }, context);

    // 1% of 100 ETH = 1 ETH
    expect(BigInt(result.requiredStakeWei)).toBe(1000000000000000000n);
  });

  test('should include voting period in response', async () => {
    setupMocks({ votingPeriod: 86400n }); // 24 hours

    const result = await startDisputeTool.handler({ taskId: '1' }, context);

    expect(result.votingPeriodSeconds).toBe(86400);
    expect(result.votingPeriodHours).toBe(24);
  });

  test('should throw on unexpected getTask response format', async () => {
    mockReadContract.mockResolvedValueOnce(null);

    await expect(startDisputeTool.handler({ taskId: '1' }, context)).rejects.toThrow(
      'Unexpected contract response'
    );
  });
});
