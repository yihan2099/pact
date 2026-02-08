import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createWeb3UtilsMock } from '../../helpers/mock-deps';

const web3Mock = createWeb3UtilsMock();

mock.module('@clawboy/web3-utils', () => web3Mock);

mock.module('../../../config/chain', () => ({
  getChainId: () => 84532,
}));

import { getFeedbackHistoryTool } from '../../../tools/agent/get-feedback-history';

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
};

describe('get_feedback_history tool', () => {
  beforeEach(() => {
    web3Mock.getAgentId.mockReset();
    web3Mock.getAgentId.mockResolvedValue(1n);
    web3Mock.getFeedbackClients.mockReset();
    web3Mock.getFeedbackClients.mockResolvedValue(['0xClient1', '0xClient2'] as any);
    web3Mock.getAllFeedback.mockReset();
    web3Mock.getAllFeedback.mockResolvedValue([
      {
        clientAddress: '0xClient1',
        feedbackIndex: 0n,
        tag1: 'task',
        tag2: 'win',
        value: 10n,
        valueDecimals: 0,
        isRevoked: false,
      },
      {
        clientAddress: '0xClient2',
        feedbackIndex: 1n,
        tag1: 'dispute',
        tag2: 'loss',
        value: -5n,
        valueDecimals: 0,
        isRevoked: false,
      },
      {
        clientAddress: '0xClient1',
        feedbackIndex: 2n,
        tag1: 'task',
        tag2: 'win',
        value: 10n,
        valueDecimals: 0,
        isRevoked: true,
      },
    ] as any);
  });

  test('should return feedback entries filtering out revoked', async () => {
    const result = await getFeedbackHistoryTool.handler({}, context);

    expect(result.success).toBe(true);
    expect(result.feedbackCount).toBe(2); // revoked one filtered out
    expect(result.feedback).toHaveLength(2);
    expect(result.totalClients).toBe(2);
  });

  test('should return not registered when agent ID is 0', async () => {
    web3Mock.getAgentId.mockResolvedValue(0n);

    const result = await getFeedbackHistoryTool.handler({}, context);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Agent not registered');
  });

  test('should pass limit parameter', async () => {
    await getFeedbackHistoryTool.handler({ limit: 10 }, context);

    expect(web3Mock.getAllFeedback).toHaveBeenCalledWith(1n, 10, 84532);
  });

  test('should throw when no address available', async () => {
    await expect(
      getFeedbackHistoryTool.handler({}, { callerAddress: undefined as any })
    ).rejects.toThrow('walletAddress is required');
  });
});
