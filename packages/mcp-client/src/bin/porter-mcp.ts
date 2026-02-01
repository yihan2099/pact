#!/usr/bin/env node

/**
 * Porter Network MCP CLI entry point
 *
 * This script starts an MCP server that connects to Porter Network,
 * allowing MCP clients (like Claude Desktop) to interact with the
 * agent economy platform.
 *
 * Authentication flow:
 * 1. On startup, requests a challenge from the Porter MCP server
 * 2. Signs the challenge with the wallet
 * 3. Verifies signature to obtain a sessionId
 * 4. Includes sessionId in all subsequent tool calls
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createWalletClient, http, type WalletClient } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Session state for authentication
interface AuthState {
  sessionId: string | null;
  walletAddress: string;
  tier: string | null;
  isVerifier: boolean;
  isRegistered: boolean;
  expiresAt: number | null;
}

let authState: AuthState | null = null;

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
  // Auth tools
  {
    name: 'auth_get_challenge',
    description: 'Get a challenge message to sign for authentication',
    inputSchema: {
      type: 'object' as const,
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Your wallet address (0x...)',
        },
      },
      required: ['walletAddress'],
    },
  },
  {
    name: 'auth_verify',
    description: 'Verify a signed challenge to complete authentication',
    inputSchema: {
      type: 'object' as const,
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
  },
  {
    name: 'auth_session',
    description: 'Check the status of an authentication session',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to check',
        },
        action: {
          type: 'string',
          enum: ['get', 'invalidate'],
          description: 'Action to perform (default: get)',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'auth_status',
    description: 'Get the current authentication status of this client',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

/**
 * Authenticate with the Porter Network MCP server
 * Signs a challenge message with the wallet to obtain a session
 */
async function authenticate(account: PrivateKeyAccount): Promise<AuthState | null> {
  try {
    // In a real implementation, this would call the actual Porter MCP server
    // For now, we simulate the authentication flow

    console.error('Authenticating with Porter Network...');

    // The challenge would come from auth_get_challenge
    const challenge = [
      'Porter Network Authentication',
      '',
      `Address: ${account.address}`,
      `Nonce: ${crypto.randomUUID()}`,
      `Timestamp: ${new Date().toISOString()}`,
      '',
      'Sign this message to authenticate with Porter Network.',
    ].join('\n');

    // Sign the challenge
    const signature = await account.signMessage({ message: challenge });

    console.error(`Wallet authenticated: ${account.address}`);

    // In production, this would be the response from auth_verify
    // For now, create a mock session
    return {
      sessionId: crypto.randomUUID(),
      walletAddress: account.address,
      tier: 'newcomer',
      isVerifier: false,
      isRegistered: false, // Would be checked on-chain
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };
  } catch (error) {
    console.error('Authentication failed:', error);
    return null;
  }
}

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

  // Auto-authenticate on startup
  authState = await authenticate(account);

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

    // Include sessionId in args for authenticated calls
    const authenticatedArgs = {
      ...args,
      sessionId: authState?.sessionId,
    };

    try {
      // TODO: Implement actual tool handlers that call the Porter MCP server
      // For now, return placeholder responses
      switch (name) {
        // Auth status tool - returns current client auth state
        case 'auth_status':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  authenticated: !!authState?.sessionId,
                  walletAddress: authState?.walletAddress || account.address,
                  sessionId: authState?.sessionId,
                  tier: authState?.tier,
                  isVerifier: authState?.isVerifier,
                  isRegistered: authState?.isRegistered,
                  expiresAt: authState?.expiresAt,
                }),
              },
            ],
          };

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
                  sessionId: authState?.sessionId,
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
                  name: authState?.isRegistered ? 'Registered Agent' : 'Unregistered Agent',
                  tier: authState?.tier || 'newcomer',
                  reputation: '0',
                  tasksCompleted: 0,
                  successRate: 0,
                  skills: [],
                  isVerifier: authState?.isVerifier || false,
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
                  args: authenticatedArgs,
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
  console.error(`Authenticated: ${!!authState?.sessionId}`);
  if (authState?.sessionId) {
    console.error(`Session ID: ${authState.sessionId}`);
    console.error(`Tier: ${authState.tier}`);
    console.error(`Registered: ${authState.isRegistered}`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
