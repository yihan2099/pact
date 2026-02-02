import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { allTools } from './tools';
import { listTasksTool } from './tools/task/list-tasks';
import { getTaskTool } from './tools/task/get-task';
import { createTaskTool } from './tools/task/create-task';
import { cancelTaskTool } from './tools/task/cancel-task';
import { submitWorkTool } from './tools/agent/submit-work';
import { getMySubmissionsTool } from './tools/agent/get-my-submissions';
import { registerAgentTool } from './tools/agent/register-agent';
import {
  getChallengeHandler,
  verifySignatureHandler,
  getSessionHandler,
} from './tools/auth';
import { getSession } from './auth/session-manager';
import { checkAccess } from './auth/access-control';
import { allPrompts, getPromptContent } from './prompts';

export interface ServerContext {
  callerAddress: `0x${string}`;
  isAuthenticated: boolean;
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
        prompts: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
  });

  // Handle prompt listing
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: allPrompts };
  });

  // Handle prompt retrieval
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    const content = getPromptContent(name);

    if (!content) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    return {
      description: allPrompts.find((p) => p.name === name)?.description || '',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: content,
          },
        },
      ],
    };
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
      isAuthenticated: false,
      isRegistered: false,
      sessionId: null,
    };

    if (sessionId) {
      const session = await getSession(sessionId);
      if (session) {
        context = {
          callerAddress: session.walletAddress,
          isAuthenticated: true,
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
        case 'submit_work':
          result = await submitWorkTool.handler(args, context);
          break;
        case 'get_my_submissions':
          result = await getMySubmissionsTool.handler(args, context);
          break;
        case 'register_agent':
          result = await registerAgentTool.handler(args, context);
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
