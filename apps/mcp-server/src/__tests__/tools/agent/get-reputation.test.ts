import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createWeb3UtilsMock } from '../../helpers/mock-deps';

const web3Mock = createWeb3UtilsMock();

mock.module('@clawboy/web3-utils', () => web3Mock);

mock.module('../../../config/chain', () => ({
  getChainId: () => 84532,
}));

import { getReputationTool } from '../../../tools/agent/get-reputation';

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
};

describe('get_reputation tool', () => {
  beforeEach(() => {
    web3Mock.getAgentId.mockReset();
    web3Mock.getAgentId.mockResolvedValue(1n);
    web3Mock.getAgentReputationSummary.mockReset();
    web3Mock.getAgentReputationSummary.mockResolvedValue({
      taskWins: 5n,
      disputeWins: 2n,
      disputeLosses: 1n,
      totalReputation: 100n,
    });
    web3Mock.getFeedbackSummary.mockReset();
  });

  test('should return reputation summary for registered agent', async () => {
    const result = await getReputationTool.handler({}, context);

    expect(result.success).toBe(true);
    expect((result as any).reputation.taskWins).toBe('5');
    expect((result as any).reputation.totalReputation).toBe('100');
    expect(result.walletAddress).toBe(context.callerAddress);
  });

  test('should return not registered message for unregistered agent', async () => {
    web3Mock.getAgentId.mockResolvedValue(0n);

    const result = await getReputationTool.handler({}, context);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Agent not registered');
  });

  test('should query by wallet address when provided', async () => {
    const target = '0x1111111111111111111111111111111111111111';
    await getReputationTool.handler({ walletAddress: target }, context);

    expect(web3Mock.getAgentId).toHaveBeenCalledWith(target, 84532);
  });

  test('should include filtered feedback when tags specified', async () => {
    web3Mock.getFeedbackSummary.mockResolvedValue({
      count: 3n,
      summaryValue: 50n,
      summaryValueDecimals: 0,
    });

    const result = await getReputationTool.handler({ tag1: 'task', tag2: 'win' }, context);

    expect((result as any).filteredFeedback).toBeDefined();
    expect((result as any).filteredFeedback.tag1).toBe('task');
    expect((result as any).filteredFeedback.tag2).toBe('win');
    expect((result as any).filteredFeedback.count).toBe('3');
  });

  test('should throw when no address available', async () => {
    await expect(
      getReputationTool.handler({}, { callerAddress: undefined as any })
    ).rejects.toThrow('walletAddress is required');
  });
});
