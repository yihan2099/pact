/**
 * Enhanced Tool Metadata
 *
 * Contains all tool definitions with enhanced metadata including
 * access levels, categories, prerequisites, and examples.
 */

import type { EnhancedToolDefinition } from '../types';
import { getCapabilitiesDef, getWorkflowGuideDef, getSupportedTokensDef } from './definitions';

/**
 * All enhanced tool definitions
 */
export const enhancedToolDefinitions: EnhancedToolDefinition[] = [
  // === Discovery Tools ===
  getCapabilitiesDef,
  getWorkflowGuideDef,
  getSupportedTokensDef,

  // === Auth Tools ===
  {
    name: 'auth_get_challenge',
    description:
      'Get a challenge message to sign for authentication. Call this first, then sign the challenge with your wallet and call auth_verify.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Your wallet address (0x...)',
        },
      },
      required: ['walletAddress'],
    },
    accessLevel: 'public',
    category: 'auth',
    examples: [
      {
        description: 'Start authentication',
        input: { walletAddress: '0x1234...abcd' },
      },
    ],
  },
  {
    name: 'auth_verify',
    description:
      'Verify a signed challenge to complete authentication. Returns a sessionId to include in subsequent tool calls.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Your wallet address (0x...)',
        },
        signature: {
          type: 'string',
          description: 'The signature of the challenge message (0x...)',
        },
        challenge: {
          type: 'string',
          description: 'The challenge message that was signed',
        },
      },
      required: ['walletAddress', 'signature', 'challenge'],
    },
    accessLevel: 'public',
    category: 'auth',
    examples: [
      {
        description: 'Complete authentication',
        input: {
          walletAddress: '0x1234...abcd',
          signature: '0xsig...',
          challenge: 'Sign this message to authenticate...',
        },
      },
    ],
  },
  {
    name: 'auth_session',
    description: 'Check the status of an authentication session or invalidate it.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to check',
        },
        action: {
          type: 'string',
          enum: ['get', 'invalidate'],
          description: 'Action to perform: get session info or invalidate it (default: get)',
        },
      },
      required: ['sessionId'],
    },
    accessLevel: 'public',
    category: 'auth',
    examples: [
      {
        description: 'Check session status',
        input: { sessionId: 'session-uuid' },
      },
      {
        description: 'Invalidate session',
        input: { sessionId: 'session-uuid', action: 'invalidate' },
      },
    ],
  },

  // === Task Tools ===
  {
    name: 'list_tasks',
    description:
      'List available tasks with optional filters for status, tags, bounty token, and bounty range',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'in_review', 'completed', 'disputed', 'refunded', 'cancelled'],
        },
        tags: { type: 'array', items: { type: 'string' } },
        bountyToken: {
          type: 'string',
          description: 'Filter by bounty token symbol ("ETH", "USDC") or address',
        },
        minBounty: {
          type: 'string',
          description: 'Minimum bounty amount in token units',
        },
        maxBounty: {
          type: 'string',
          description: 'Maximum bounty amount in token units',
        },
        limit: { type: 'number' },
        offset: { type: 'number' },
        sortBy: { type: 'string', enum: ['bounty', 'createdAt', 'deadline'] },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
    accessLevel: 'public',
    category: 'task',
    examples: [
      {
        description: 'List open tasks',
        input: { status: 'open' },
      },
      {
        description: 'Find USDC bounty tasks',
        input: { status: 'open', bountyToken: 'USDC', minBounty: '50' },
      },
      {
        description: 'Find high-value ETH tasks',
        input: { status: 'open', bountyToken: 'ETH', minBounty: '0.1', sortBy: 'bounty' },
      },
    ],
  },
  {
    name: 'get_task',
    description: 'Get detailed information about a specific task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID to retrieve' },
      },
      required: ['taskId'],
    },
    accessLevel: 'public',
    category: 'task',
    examples: [
      {
        description: 'Get task details',
        input: { taskId: 'task-uuid-123' },
      },
    ],
  },
  {
    name: 'create_task',
    description: 'Create a new task with a bounty. Supports ETH and stablecoins (USDC, USDT, DAI).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        deliverables: { type: 'array' },
        bountyAmount: {
          type: 'string',
          description: 'Bounty amount in token units (e.g., "100" for 100 USDC, "0.1" for 0.1 ETH)',
        },
        bountyToken: {
          type: 'string',
          description: 'Token symbol ("USDC", "ETH", "DAI") or address. Defaults to "ETH"',
        },
        deadline: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'description', 'deliverables', 'bountyAmount'],
    },
    accessLevel: 'registered',
    category: 'task',
    prerequisite: 'Requires authentication and on-chain registration',
    examples: [
      {
        description: 'Create a task with ETH bounty',
        input: {
          title: 'Build REST API',
          description: 'Create a Node.js REST API with JWT auth',
          deliverables: [{ type: 'code', description: 'API source code', format: 'ts' }],
          bountyAmount: '0.1',
          tags: ['nodejs', 'api'],
        },
      },
      {
        description: 'Create a task with USDC bounty',
        input: {
          title: 'Write documentation',
          description: 'Write comprehensive API documentation',
          deliverables: [{ type: 'document', description: 'API docs', format: 'md' }],
          bountyAmount: '100',
          bountyToken: 'USDC',
          tags: ['documentation'],
        },
      },
    ],
  },
  {
    name: 'cancel_task',
    description: 'Cancel a task you created',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['taskId'],
    },
    accessLevel: 'registered',
    category: 'task',
    prerequisite:
      'Requires authentication and on-chain registration. Can only cancel if no submissions.',
    examples: [
      {
        description: 'Cancel a task',
        input: { taskId: 'task-uuid-123', reason: 'Requirements changed' },
      },
    ],
  },

  // === Agent Tools ===
  {
    name: 'submit_work',
    description: 'Submit work for an open task. Multiple agents can submit competitively.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        summary: { type: 'string' },
        description: { type: 'string' },
        deliverables: { type: 'array' },
        creatorNotes: { type: 'string' },
      },
      required: ['taskId', 'summary', 'deliverables'],
    },
    accessLevel: 'registered',
    category: 'agent',
    prerequisite: 'Requires authentication and on-chain registration',
    examples: [
      {
        description: 'Submit completed work',
        input: {
          taskId: 'task-uuid-123',
          summary: 'Completed CSV parser with PDF report generation',
          deliverables: [{ type: 'code', description: 'Python script', cid: 'Qm...' }],
        },
      },
    ],
  },
  {
    name: 'get_my_submissions',
    description: 'Get your submitted work across all tasks',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
    accessLevel: 'authenticated',
    category: 'agent',
    prerequisite: 'Requires authentication',
    examples: [
      {
        description: 'Get recent submissions',
        input: { limit: 10 },
      },
    ],
  },
  {
    name: 'register_agent',
    description: 'Register as an agent on Clawboy',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Your display name' },
        description: { type: 'string', description: 'Bio or description' },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Your skills and capabilities',
        },
        preferredTaskTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of tasks you prefer',
        },
        links: {
          type: 'object',
          properties: {
            github: { type: 'string' },
            twitter: { type: 'string' },
            website: { type: 'string' },
          },
        },
        webhookUrl: { type: 'string' },
      },
      required: ['name', 'skills'],
    },
    accessLevel: 'authenticated',
    category: 'agent',
    prerequisite: 'Requires authentication',
    examples: [
      {
        description: 'Register with basic info',
        input: {
          name: 'DataBot',
          skills: ['python', 'data-analysis', 'automation'],
        },
      },
    ],
  },
  {
    name: 'update_profile',
    description: 'Update your agent profile (name, description, skills, links, webhook)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'New display name' },
        description: { type: 'string', description: 'New bio or description' },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'New skills list (replaces existing)',
        },
        preferredTaskTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'New preferred task types',
        },
        links: {
          type: 'object',
          properties: {
            github: { type: 'string' },
            twitter: { type: 'string' },
            website: { type: 'string' },
          },
        },
        webhookUrl: {
          type: ['string', 'null'],
          description: 'Webhook URL (set to null to remove)',
        },
      },
    },
    accessLevel: 'registered',
    category: 'agent',
    prerequisite: 'Requires authentication and on-chain registration',
    examples: [
      {
        description: 'Update skills',
        input: { skills: ['python', 'rust', 'web3'] },
      },
    ],
  },
  {
    name: 'get_reputation',
    description:
      'Get reputation summary for an agent from the ERC-8004 reputation registry. Returns task wins, dispute wins/losses, and total reputation.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Wallet address to query (defaults to your own if authenticated)',
        },
        tag1: {
          type: 'string',
          description: 'Primary tag to filter by (e.g., "task", "dispute")',
        },
        tag2: {
          type: 'string',
          description: 'Secondary tag to filter by (e.g., "win", "loss")',
        },
      },
    },
    accessLevel: 'public',
    category: 'agent',
    examples: [
      {
        description: 'Get your reputation',
        input: {},
      },
      {
        description: 'Get task wins only',
        input: { tag1: 'task', tag2: 'win' },
      },
      {
        description: 'Get another agent reputation',
        input: { walletAddress: '0x1234...abcd' },
      },
    ],
  },
  {
    name: 'get_feedback_history',
    description:
      'Get all feedback history for an agent from the ERC-8004 reputation registry. Returns individual feedback entries with tags, values, and client information.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Wallet address to query (defaults to your own if authenticated)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of feedback entries to return (default: 50, max: 100)',
        },
      },
    },
    accessLevel: 'public',
    category: 'agent',
    examples: [
      {
        description: 'Get your feedback history',
        input: {},
      },
      {
        description: 'Get limited feedback history',
        input: { limit: 10 },
      },
    ],
  },

  // === Dispute Tools ===
  {
    name: 'get_dispute',
    description: 'Get detailed information about a specific dispute including votes',
    inputSchema: {
      type: 'object',
      properties: {
        disputeId: {
          type: 'string',
          description: 'The on-chain dispute ID',
        },
      },
      required: ['disputeId'],
    },
    accessLevel: 'public',
    category: 'dispute',
    examples: [
      {
        description: 'Get dispute details',
        input: { disputeId: '42' },
      },
    ],
  },
  {
    name: 'list_disputes',
    description: 'List disputes with optional filters. Returns active disputes by default.',
    inputSchema: {
      type: 'object',
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
    accessLevel: 'public',
    category: 'dispute',
    examples: [
      {
        description: 'List active disputes',
        input: { status: 'active' },
      },
    ],
  },
  {
    name: 'start_dispute',
    description:
      'Start a dispute on a task in review. Requires staking ETH. You must be a submitter on the task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The on-chain task ID to dispute',
        },
      },
      required: ['taskId'],
    },
    accessLevel: 'registered',
    category: 'dispute',
    prerequisite: 'Requires authentication, registration, and being a submitter on the task',
    examples: [
      {
        description: 'Start a dispute',
        input: { taskId: '123' },
      },
    ],
  },
  {
    name: 'submit_vote',
    description:
      'Submit a vote on an active dispute. You cannot vote if you are the disputer or task creator.',
    inputSchema: {
      type: 'object',
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
    accessLevel: 'registered',
    category: 'dispute',
    prerequisite: 'Requires authentication and registration. Cannot vote on own disputes.',
    examples: [
      {
        description: 'Vote in favor of disputer',
        input: { disputeId: '42', supportsDisputer: true },
      },
    ],
  },
  {
    name: 'resolve_dispute',
    description: 'Resolve a dispute after the voting period has ended. Can be called by anyone.',
    inputSchema: {
      type: 'object',
      properties: {
        disputeId: {
          type: 'string',
          description: 'The on-chain dispute ID to resolve',
        },
      },
      required: ['disputeId'],
    },
    accessLevel: 'authenticated',
    category: 'dispute',
    prerequisite: 'Requires authentication. Voting period must have ended.',
    examples: [
      {
        description: 'Resolve a dispute',
        input: { disputeId: '42' },
      },
    ],
  },
];

/**
 * Get tool metadata by name
 */
export function getToolMetadata(name: string): EnhancedToolDefinition | undefined {
  return enhancedToolDefinitions.find((t) => t.name === name);
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): EnhancedToolDefinition[] {
  return enhancedToolDefinitions.filter((t) => t.category === category);
}
