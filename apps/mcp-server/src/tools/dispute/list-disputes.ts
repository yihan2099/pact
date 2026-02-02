import { z } from 'zod';
import { listActiveDisputes, getDisputesReadyForResolution } from '@porternetwork/database';
import { getSupabaseClient } from '@porternetwork/database';
import type { DisputeStatus } from '@porternetwork/shared-types';

export const listDisputesSchema = z.object({
  status: z.enum(['active', 'resolved', 'all']).optional().default('active'),
  taskId: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

export type ListDisputesInput = z.infer<typeof listDisputesSchema>;

export const listDisputesTool = {
  name: 'list_disputes',
  description: 'List disputes with optional filters. Returns active disputes by default.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'resolved', 'all'],
        description: 'Filter by status (default: active)',
      },
      taskId: {
        type: 'string',
        description: 'Filter by task ID',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of disputes to return (default: 20, max: 100)',
      },
      offset: {
        type: 'number',
        description: 'Number of disputes to skip for pagination (default: 0)',
      },
    },
  },
  handler: async (args: unknown) => {
    const input = listDisputesSchema.parse(args);
    const supabase = getSupabaseClient();

    // Build query
    let query = supabase.from('disputes').select('*', { count: 'exact' });

    // Apply status filter
    if (input.status === 'active') {
      query = query.eq('status', 'active');
    } else if (input.status === 'resolved') {
      query = query.eq('status', 'resolved');
    }
    // 'all' - no status filter

    // Apply task filter
    if (input.taskId) {
      query = query.eq('task_id', input.taskId);
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list disputes: ${error.message}`);
    }

    // Get disputes ready for resolution
    const readyForResolution = await getDisputesReadyForResolution();
    const readyIds = new Set(readyForResolution.map((d) => d.id));

    const disputes = (data ?? []).map((d) => ({
      id: d.id,
      chainDisputeId: d.chain_dispute_id,
      taskId: d.task_id,
      disputerAddress: d.disputer_address,
      disputeStake: d.dispute_stake,
      votingDeadline: d.voting_deadline,
      status: d.status as DisputeStatus,
      disputerWon: d.disputer_won,
      votesForDisputer: d.votes_for_disputer,
      votesAgainstDisputer: d.votes_against_disputer,
      createdAt: d.created_at,
      canBeResolved: readyIds.has(d.id),
    }));

    return {
      disputes,
      pagination: {
        total: count ?? 0,
        limit: input.limit,
        offset: input.offset,
        hasMore: (count ?? 0) > input.offset + input.limit,
      },
      readyForResolutionCount: readyForResolution.length,
    };
  },
};
