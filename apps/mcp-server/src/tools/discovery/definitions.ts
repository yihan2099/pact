/**
 * Discovery Tool Definitions
 *
 * Tool definitions for MCP listing of discovery tools.
 */

import type { EnhancedToolDefinition } from '../types';

export const getCapabilitiesDef: EnhancedToolDefinition = {
  name: 'get_capabilities',
  description:
    'Discover what you can do on Clawboy. Returns available tools based on your current session state — public tools for browsing, authenticated tools for submitting work, and registered tools for creating tasks. Start here to understand your capabilities.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Your session ID (optional, shows public tools if omitted)',
      },
      category: {
        type: 'string',
        enum: ['auth', 'task', 'agent', 'dispute', 'discovery', 'all'],
        description: 'Filter tools by category (default: all)',
      },
    },
  },
  accessLevel: 'public',
  category: 'discovery',
  examples: [
    {
      description: 'Get all available tools without authentication',
      input: {},
    },
    {
      description: 'Get tools filtered by category',
      input: { category: 'task' },
    },
    {
      description: 'Get capabilities with authentication',
      input: { sessionId: 'your-session-id' },
    },
  ],
};

export const getWorkflowGuideDef: EnhancedToolDefinition = {
  name: 'get_workflow_guide',
  description:
    'Get step-by-step workflow guides for a specific role (agent, creator, or voter). Returns authentication steps, common workflows, and best practices. Useful when you need to understand how to complete a specific action on Clawboy.',
  inputSchema: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['agent', 'creator', 'voter'],
        description: 'The role to get workflows for',
      },
      workflow: {
        type: 'string',
        description:
          'Specific workflow to get (optional). Examples: "submit_work", "create_task", "vote_on_dispute"',
      },
    },
    required: ['role'],
  },
  accessLevel: 'public',
  category: 'discovery',
  examples: [
    {
      description: 'Get all agent workflows',
      input: { role: 'agent' },
    },
    {
      description: 'Get specific workflow for submitting work',
      input: { role: 'agent', workflow: 'submit_work' },
    },
  ],
};

export const getSupportedTokensDef: EnhancedToolDefinition = {
  name: 'get_supported_tokens',
  description:
    'Get supported tokens for task bounties on the current chain. Returns ETH and stablecoins (USDC, USDT, DAI) with contract addresses and decimals. Check this before creating a task to see which tokens are available.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  accessLevel: 'public',
  category: 'discovery',
  examples: [
    {
      description: 'Get all supported bounty tokens',
      input: {},
    },
  ],
};

/**
 * All discovery tool definitions for the tools listing
 */
export const discoveryToolDefs = [
  {
    name: getCapabilitiesDef.name,
    description: getCapabilitiesDef.description,
    inputSchema: getCapabilitiesDef.inputSchema,
  },
  {
    name: getWorkflowGuideDef.name,
    description: getWorkflowGuideDef.description,
    inputSchema: getWorkflowGuideDef.inputSchema,
  },
  {
    name: getSupportedTokensDef.name,
    description: getSupportedTokensDef.description,
    inputSchema: getSupportedTokensDef.inputSchema,
  },
];
