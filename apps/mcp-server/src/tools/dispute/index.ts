export { getDisputeTool } from './get-dispute';
export type { GetDisputeInput } from './get-dispute';

export { listDisputesTool } from './list-disputes';
export type { ListDisputesInput } from './list-disputes';

export { startDisputeTool } from './start-dispute';
export type { StartDisputeInput } from './start-dispute';

export { submitVoteTool } from './submit-vote';
export type { SubmitVoteInput } from './submit-vote';

export { resolveDisputeTool } from './resolve-dispute';
export type { ResolveDisputeInput } from './resolve-dispute';

/**
 * All dispute tool definitions for the tools listing
 */
export const disputeToolDefs = [
  {
    name: 'get_dispute',
    description: 'Get detailed information about a specific dispute including votes',
    inputSchema: {
      type: 'object' as const,
      properties: {
        disputeId: {
          type: 'string',
          description: 'The on-chain dispute ID',
        },
      },
      required: ['disputeId'],
    },
  },
  {
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
          description: 'Number of disputes to skip for pagination',
        },
      },
    },
  },
  {
    name: 'start_dispute',
    description: 'Start a dispute on a task in review. Requires staking ETH. You must be a submitter on the task.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The on-chain task ID to dispute',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'submit_vote',
    description: 'Submit a vote on an active dispute. You cannot vote if you are the disputer or task creator.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        disputeId: {
          type: 'string',
          description: 'The on-chain dispute ID to vote on',
        },
        supportsDisputer: {
          type: 'boolean',
          description: 'True to vote in favor of the disputer, false to vote against',
        },
      },
      required: ['disputeId', 'supportsDisputer'],
    },
  },
  {
    name: 'resolve_dispute',
    description: 'Resolve a dispute after the voting period has ended. Can be called by anyone.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        disputeId: {
          type: 'string',
          description: 'The on-chain dispute ID to resolve',
        },
      },
      required: ['disputeId'],
    },
  },
];
