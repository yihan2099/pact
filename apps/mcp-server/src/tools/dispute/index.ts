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
    description:
      "Get full details of a dispute including both sides' arguments, vote tallies, and resolution status. Use this to review evidence before voting.",
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
    description:
      'Browse active and resolved disputes. Active disputes need votes — participating earns reputation and rewards for correct judgments.',
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
    description:
      'Challenge a winner selection by staking ETH during the 48-hour review window. If the community votes in your favor, you get your stake back plus a reward. You must be a submitter on the task.',
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
    description:
      'Vote on an active dispute to help the community select the rightful winner. Correct votes earn rewards. You cannot vote on disputes where you are the challenger or task creator.',
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
    description:
      'Execute the final resolution of a dispute after voting ends. Distributes bounty to the winner and rewards to correct voters. Can be called by anyone.',
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
