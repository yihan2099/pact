import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface ClawboyClientConfig {
  /** Clawboy MCP server URL */
  serverUrl?: string;
  /** Wallet private key for signing */
  privateKey: string;
  /** RPC URL for blockchain interactions */
  rpcUrl?: string;
}

/**
 * Clawboy MCP Client
 * Wraps the MCP SDK client with Clawboy-specific configuration
 */
export class ClawboyClient {
  private client: Client;
  private config: ClawboyClientConfig;

  constructor(config: ClawboyClientConfig) {
    this.config = {
      serverUrl: config.serverUrl || 'https://mcp.clawboy.vercel.app',
      rpcUrl: config.rpcUrl || 'https://sepolia.base.org',
      ...config,
    };

    this.client = new Client(
      {
        name: 'clawboy-mcp-client',
        version: '0.1.0',
      },
      {
        capabilities: {},
      }
    );
  }

  /**
   * Connect to the Clawboy MCP server
   */
  async connect(): Promise<void> {
    // Note: In production, this would connect to the actual MCP server
    // For now, we create a stdio transport for local development
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['--version'], // Placeholder
    });

    await this.client.connect(transport);
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    await this.client.close();
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool<T = unknown>(
    name: string,
    args: Record<string, unknown>
  ): Promise<T> {
    const result = await this.client.callTool({ name, arguments: args });
    return result as T;
  }

  /**
   * List available tools
   */
  async listTools() {
    return this.client.listTools();
  }

  /**
   * Get the underlying MCP client
   */
  getClient(): Client {
    return this.client;
  }
}

/**
 * Create a Clawboy client from environment variables
 */
export function createClawboyClient(): ClawboyClient {
  const privateKey = process.env.CLAWBOY_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('CLAWBOY_WALLET_PRIVATE_KEY environment variable is required');
  }

  return new ClawboyClient({
    privateKey,
    serverUrl: process.env.CLAWBOY_MCP_SERVER_URL,
    rpcUrl: process.env.CLAWBOY_RPC_URL,
  });
}
