import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createDatabaseMock } from '../../helpers/mock-deps';

const dbMock = createDatabaseMock();

mock.module('@clawboy/database', () => dbMock);

import { getDisputeTool } from '../../../tools/dispute/get-dispute';

describe('get_dispute tool', () => {
  beforeEach(() => {
    dbMock.getDisputeByChainId.mockReset();
    dbMock.getDisputeByChainId.mockResolvedValue({
      id: 'dispute-uuid',
      chain_dispute_id: '1',
      task_id: 'task-1',
      disputer_address: '0xDisputer',
      dispute_stake: '10000000000000000',
      voting_deadline: new Date(Date.now() + 86400000).toISOString(),
      status: 'active',
      disputer_won: null,
      votes_for_disputer: 10,
      votes_against_disputer: 5,
      created_at: '2024-01-01T00:00:00Z',
      resolved_at: null,
    } as any);
    dbMock.getDisputeVotes.mockReset();
    dbMock.getDisputeVotes.mockResolvedValue([
      {
        voter_address: '0xVoter1',
        supports_disputer: true,
        vote_weight: 5,
        voted_at: '2024-01-02T00:00:00Z',
      },
    ] as any);
  });

  test('should return dispute with votes and summary', async () => {
    const result = await getDisputeTool.handler({ disputeId: '1' });

    expect(result.dispute.chainDisputeId).toBe('1');
    expect(result.dispute.status).toBe('active' as any);
    expect(result.votes).toHaveLength(1);
    expect(result.votes[0].voterAddress).toBe('0xVoter1');
    expect(result.summary.totalVotes).toBe(1);
    expect(result.summary.isActive).toBe(true);
  });

  test('should throw when dispute not found', async () => {
    dbMock.getDisputeByChainId.mockResolvedValue(null as any);

    await expect(getDisputeTool.handler({ disputeId: '99' })).rejects.toThrow('Dispute not found');
  });

  test('should compute canBeResolved correctly', async () => {
    // Active but deadline not passed
    const result = await getDisputeTool.handler({ disputeId: '1' });
    expect(result.summary.canBeResolved).toBe(false);
  });

  test('should show canBeResolved when deadline passed and active', async () => {
    dbMock.getDisputeByChainId.mockResolvedValue({
      id: 'dispute-uuid',
      chain_dispute_id: '1',
      task_id: 'task-1',
      disputer_address: '0xDisputer',
      dispute_stake: '10000000000000000',
      voting_deadline: new Date(Date.now() - 86400000).toISOString(), // past
      status: 'active',
      disputer_won: null,
      votes_for_disputer: 10,
      votes_against_disputer: 5,
      created_at: '2024-01-01T00:00:00Z',
      resolved_at: null,
    } as any);

    const result = await getDisputeTool.handler({ disputeId: '1' });
    expect(result.summary.canBeResolved).toBe(true);
    expect(result.summary.timeRemainingMs).toBe(0);
  });
});
