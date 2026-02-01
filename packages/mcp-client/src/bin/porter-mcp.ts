#!/usr/bin/env node

/**
 * Porter Network MCP CLI entry point
 *
 * This script starts an MCP server that connects to Porter Network,
 * allowing MCP clients (like Claude Desktop) to interact with the
 * agent economy platform.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createWalletClient, http, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Tool definitions
const TOOLS = [
  {
    name: 'list_tasks',
    description: 'List available tasks with optional filters',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'claimed', 'submitted', 'completed'],
          description: 'Filter by task status',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
        minBounty: {
          type: 'string',
          description: 'Minimum bounty in ETH',
        },
        maxBounty: {
          type: 'string',
          description: 'Maximum bounty in ETH',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return',
          default: 20,
        },
      },
    },
  },
  {
    name: 'get_task',
    description: 'Get detailed information about a specific task',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to retrieve',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task with a bounty',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Task title',
        },
        description: {
          type: 'string',
          description: 'Detailed task description',
        },
        deliverables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['code', 'document', 'data', 'file', 'other'] },
              description: { type: 'string' },
            },
            required: ['type', 'description'],
          },
          description: 'Expected deliverables',
        },
        bountyAmount: {
          type: 'string',
          description: 'Bounty amount in ETH',
        },
        deadline: {
          type: 'string',
          description: 'Optional deadline (ISO 8601 format)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
      },
      required: ['title', 'description', 'deliverables', 'bountyAmount'],
    },
  },
  {
    name: 'claim_task',
    description: 'Claim a task to work on',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to claim',
        },
        message: {
          type: 'string',
          description: 'Optional message to the task creator',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'submit_work',
    description: 'Submit completed work for a claimed task',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID',
        },
        summary: {
          type: 'string',
          description: 'Summary of work completed',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the work',
        },
        deliverables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              description: { type: 'string' },
              url: { type: 'string' },
            },
            required: ['type', 'description'],
          },
          description: 'Submitted deliverables',
        },
        verifierNotes: {
          type: 'string',
          description: 'Notes for the verifier',
        },
      },
      required: ['taskId', 'summary', 'deliverables'],
    },
  },
  {
    name: 'get_my_claims',
    description: 'Get your claimed tasks',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'submitted', 'approved', 'rejected'],
          description: 'Filter by claim status',
        },
        limit: {
          type: 'number',
          description: 'Number of results',
          default: 20,
        },
      },
    },
  },
  {
    name: 'get_balance',
    description: 'Get your wallet balance',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tokenAddress: {
          type: 'string',
          description: 'Optional token address (omit for ETH)',
        },
      },
    },
  },
  {
    name: 'get_profile',
    description: 'Get agent profile information',
    inputSchema: {
      type: 'object' as const,
      properties: {
        address: {
          type: 'string',
          description: 'Agent address (omit for your own profile)',
        },
      },
    },
  },
];

async function main() {
  // Validate environment
  const privateKey = process.env.PORTER_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PORTER_WALLET_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  // Create wallet client
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const rpcUrl = process.env.PORTER_RPC_URL || 'https://sepolia.base.org';

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  // Create MCP server
  const server = new Server(
    {
      name: 'porter-network',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // TODO: Implement actual tool handlers that call the Porter MCP server
      // For now, return placeholder responses
      switch (name) {
        case 'list_tasks':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  tasks: [],
                  total: 0,
                  hasMore: false,
                  message: 'Connected to Porter Network. No tasks found matching criteria.',
                }),
              },
            ],
          };

        case 'get_task':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Task not found',
                  taskId: args?.taskId,
                }),
              },
            ],
          };

        case 'get_balance':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  address: account.address,
                  balance: '0',
                  symbol: 'ETH',
                  decimals: 18,
                }),
              },
            ],
          };

        case 'get_profile':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  address: args?.address || account.address,
                  name: 'Unregistered Agent',
                  tier: 'newcomer',
                  reputation: '0',
                  tasksCompleted: 0,
                  successRate: 0,
                  skills: [],
                  isVerifier: false,
                  stakedAmount: '0',
                }),
              },
            ],
          };

        default:
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: `Tool ${name} is not yet implemented`,
                  args,
                }),
              },
            ],
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Porter Network MCP server started');
  console.error(`Wallet: ${account.address}`);
  console.error(`RPC: ${rpcUrl}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
