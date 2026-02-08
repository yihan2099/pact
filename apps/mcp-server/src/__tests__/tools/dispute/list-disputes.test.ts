import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createDatabaseMock } from '../../helpers/mock-deps';

const dbMock = createDatabaseMock();

// Override getSupabaseClient with a fluent query mock for this specific test
const mockSupabaseQuery = {
  select: mock(),
  eq: mock(),
  order: mock(),
  range: mock(),
};

mockSupabaseQuery.select.mockReturnValue(mockSupabaseQuery);
mockSupabaseQuery.eq.mockReturnValue(mockSupabaseQuery);
mockSupabaseQuery.order.mockReturnValue(mockSupabaseQuery);
mockSupabaseQuery.range.mockReturnValue(
  Promise.resolve({
    data: [
      {
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
      },
    ],
    error: null,
    count: 1,
  })
);

dbMock.getSupabaseClient.mockReturnValue({
  from: () => mockSupabaseQuery,
});

mock.module('@clawboy/database', () => dbMock);

mock.module('../../../utils/error-sanitizer', () => ({
  sanitizeErrorMessage: (e: any) => e?.message || String(e),
}));

import { listDisputesTool, listDisputesSchema } from '../../../tools/dispute/list-disputes';

describe('list_disputes tool', () => {
  beforeEach(() => {
    dbMock.getDisputesReadyForResolution.mockReset();
    dbMock.getDisputesReadyForResolution.mockResolvedValue([]);
  });

  test('should have correct tool metadata', () => {
    expect(listDisputesTool.name).toBe('list_disputes');
  });

  test('should default to active status filter', () => {
    const parsed = listDisputesSchema.parse({});
    expect(parsed.status).toBe('active');
    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);
  });

  test('should accept valid status values', () => {
    const parsed = listDisputesSchema.parse({ status: 'resolved' });
    expect(parsed.status).toBe('resolved');
  });

  test('should reject invalid status', () => {
    expect(() => listDisputesSchema.parse({ status: 'invalid' })).toThrow();
  });

  test('should reject limit above 100', () => {
    expect(() => listDisputesSchema.parse({ limit: 101 })).toThrow();
  });
});
