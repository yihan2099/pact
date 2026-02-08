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
    disputeResolver: '0xDisputeResolver',
  }),
}));

mock.module('../../../config/chain', () => ({
  getChainId: () => 84532,
}));

mock.module('viem', () => ({
  formatEther: (val: bigint) => (Number(val) / 1e18).toString(),
}));

import { resolveDisputeTool } from '../../../tools/dispute/resolve-dispute';

const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 86400);
const futureDeadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

describe('resolve_dispute tool', () => {
  beforeEach(() => {
    mockReadContract.mockReset();
  });

  function createDisputeResponse(
    overrides: Partial<{
      id: bigint;
      taskId: bigint;
      disputer: string;
      disputeStake: bigint;
      votingDeadline: bigint;
      status: number;
      disputerWon: boolean;
      votesForDisputer: bigint;
      votesAgainstDisputer: bigint;
    }> = {}
  ) {
    return {
      id: overrides.id ?? 1n,
      taskId: overrides.taskId ?? 1n,
      disputer: overrides.disputer ?? '0xDisputer',
      disputeStake: overrides.disputeStake ?? 10000000000000000n,
      votingDeadline: overrides.votingDeadline ?? pastDeadline,
      status: overrides.status ?? 0,
      disputerWon: overrides.disputerWon ?? false,
      votesForDisputer: overrides.votesForDisputer ?? 70n,
      votesAgainstDisputer: overrides.votesAgainstDisputer ?? 30n,
    };
  }

  test('should prepare resolution when disputer wins (>=60%)', async () => {
    mockReadContract.mockResolvedValueOnce(
      createDisputeResponse({
        votesForDisputer: 70n,
        votesAgainstDisputer: 30n,
      })
    );

    const result = await resolveDisputeTool.handler({ disputeId: '1' });

    expect(result.disputerWillWin).toBe(true);
    expect(result.expectedOutcome).toContain('wins');
    expect(result.contractFunction).toBe('resolveDispute(uint256 disputeId)');
  });

  test('should prepare resolution when disputer loses (<60%)', async () => {
    mockReadContract.mockResolvedValueOnce(
      createDisputeResponse({
        votesForDisputer: 40n,
        votesAgainstDisputer: 60n,
      })
    );

    const result = await resolveDisputeTool.handler({ disputeId: '1' });

    expect(result.disputerWillWin).toBe(false);
    expect(result.expectedOutcome).toContain('loses');
  });

  test('should handle no votes cast', async () => {
    mockReadContract.mockResolvedValueOnce(
      createDisputeResponse({
        votesForDisputer: 0n,
        votesAgainstDisputer: 0n,
      })
    );

    const result = await resolveDisputeTool.handler({ disputeId: '1' });

    expect(result.disputerWillWin).toBe(false);
    expect(result.expectedOutcome).toContain('no votes');
  });

  test('should throw when dispute not found', async () => {
    mockReadContract.mockResolvedValueOnce(createDisputeResponse({ id: 0n }));

    await expect(resolveDisputeTool.handler({ disputeId: '99' })).rejects.toThrow(
      'Dispute not found'
    );
  });

  test('should throw when dispute already resolved', async () => {
    mockReadContract.mockResolvedValueOnce(createDisputeResponse({ status: 1 }));

    await expect(resolveDisputeTool.handler({ disputeId: '1' })).rejects.toThrow(
      'already resolved'
    );
  });

  test('should throw when voting period not ended', async () => {
    mockReadContract.mockResolvedValueOnce(
      createDisputeResponse({
        votingDeadline: futureDeadline,
      })
    );

    await expect(resolveDisputeTool.handler({ disputeId: '1' })).rejects.toThrow(
      'Voting period has not ended'
    );
  });
});
