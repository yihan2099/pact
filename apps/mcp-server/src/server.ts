import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
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

export interface ServerContext {
  callerAddress: `0x${string}`;
  isVerifier: boolean;
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

    // TODO: Extract context from authenticated session
    const context: ServerContext = {
      callerAddress: '0x0000000000000000000000000000000000000000',
      isVerifier: false,
    };

    try {
      let result: unknown;

      switch (name) {
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
