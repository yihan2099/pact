/**
 * Pact MCP Server
 *
 * This server exposes Pact functionality via the Model Context Protocol,
 * allowing AI agents to interact with the agent economy platform.
 *
 * Supports two transport modes:
 * - HTTP: For remote clients (mcp-client package)
 * - stdio: For local MCP connections (Claude Desktop direct integration)
 */

import { startServer } from './server';
import { startHttpServer } from './http-server';

async function main() {
  console.error('Starting Pact MCP Server...');
  console.error(`Environment: ${process.env.NODE_ENV || 'development'}`);

  const httpPort = parseInt(process.env.PORT || '3001');
  const enableStdio = process.env.ENABLE_STDIO !== 'false';

  try {
    // Start HTTP server for remote clients
    startHttpServer(httpPort);

    // Also start stdio server for local development (unless disabled)
    if (enableStdio) {
      await startServer();
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
