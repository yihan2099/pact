/**
 * Porter Network MCP Server
 *
 * This server exposes Porter Network functionality via the Model Context Protocol,
 * allowing AI agents to interact with the agent economy platform.
 */

import { startServer } from './server';

async function main() {
  console.error('Starting Porter Network MCP Server...');
  console.error(`Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    await startServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
