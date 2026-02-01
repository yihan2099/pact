import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { AgentTier } from '@porternetwork/shared-types';
import { allTools } from './tools';
import { listTasksTool } from './tools/task/list-tasks';
import { getTaskTool } from './tools/task/get-task';
import { createTaskTool } from './tools/task/create-task';
import { cancelTaskTool } from './tools/task/cancel-task';
import { claimTaskTool } from './tools/agent/claim-task';
import { submitWorkTool } from './tools/agent/submit-work';
import { getMyClaimsTool } from './tools/agent/get-my-claims';
import { listPendingTool } from './tools/verifier/list-pending';
import { submitVerdictTool } from './tools/verifier/submit-verdict';
import {
  getChallengeHandler,
  verifySignatureHandler,
  getSessionHandler,
} from './tools/auth';
import { getSession } from './auth/session-manager';
import { checkAccess } from './auth/access-control';

export interface ServerContext {
  callerAddress: `0x${string}`;
  isVerifier: boolean;
  isAuthenticated: boolean;
  tier: AgentTier | null;
  isRegistered: boolean;
  sessionId: string | null;
}

/**
 * Create and configure the MCP server
 */
export function createMcpServer() {
  const server = new Server(
    {
      name: 'porter-network-mcp',
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
    return { tools: allTools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Extract sessionId from args if provided
    const typedArgs = args as Record<string, unknown> | undefined;
    const sessionId = typedArgs?.sessionId as string | undefined;

    // Build context from session
    let context: ServerContext = {
      callerAddress: '0x0000000000000000000000000000000000000000',
      isVerifier: false,
      isAuthenticated: false,
      tier: null,
      isRegistered: false,
      sessionId: null,
    };

    if (sessionId) {
      const session = getSession(sessionId);
      if (session) {
        context = {
          callerAddress: session.walletAddress,
          isVerifier: session.isVerifier,
          isAuthenticated: true,
          tier: session.tier,
          isRegistered: session.isRegistered,
          sessionId,
        };
      }
    }

    // Check access control
    const accessCheck = checkAccess(name, context);
    if (!accessCheck.allowed) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Access denied',
              reason: accessCheck.reason,
            }),
          },
        ],
        isError: true,
      };
    }

    try {
      let result: unknown;

      switch (name) {
        // Auth tools
        case 'auth_get_challenge':
          result = await getChallengeHandler(args);
          break;
        case 'auth_verify':
          result = await verifySignatureHandler(args);
          break;
        case 'auth_session':
          result = await getSessionHandler(args);
          break;

        // Task tools
        case 'list_tasks':
          result = await listTasksTool.handler(args);
          break;
        case 'get_task':
          result = await getTaskTool.handler(args);
          break;
        case 'create_task':
          result = await createTaskTool.handler(args, context);
          break;
        case 'cancel_task':
          result = await cancelTaskTool.handler(args, context);
          break;
        case 'claim_task':
          result = await claimTaskTool.handler(args, context);
          break;
        case 'submit_work':
          result = await submitWorkTool.handler(args, context);
          break;
        case 'get_my_claims':
          result = await getMyClaimsTool.handler(args, context);
          break;
        case 'list_pending_verifications':
          result = await listPendingTool.handler(args, context);
          break;
        case 'submit_verdict':
          result = await submitVerdictTool.handler(args, context);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
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

  return server;
}

/**
 * Start the server with stdio transport
 */
export async function startServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('Porter Network MCP Server started');
  return server;
}
