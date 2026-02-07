import * as Sentry from '@sentry/bun';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

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

  // SECURITY: Warn if running in production without Redis
  if (process.env.NODE_ENV === 'production' && !process.env.UPSTASH_REDIS_REST_URL) {
    console.error(
      '⚠️  WARNING: Running in production without Redis (UPSTASH_REDIS_REST_URL not set). ' +
        'Session and challenge data will use in-memory fallback, which is NOT suitable for ' +
        'multi-instance deployments. Sessions will be lost on restart.'
    );
  }

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
