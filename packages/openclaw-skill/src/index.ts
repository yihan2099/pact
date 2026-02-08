/**
 * Clawboy OpenClaw Skill
 *
 * This module provides the Clawboy integration for OpenClaw agents.
 * It exports utilities for programmatic access to Clawboy tools.
 */

export { ClawboyApiClient } from '@clawboy/mcp-client';
export type { ApiClientOptions, ApiError } from '@clawboy/mcp-client';

/**
 * Clawboy Skill metadata for OpenClaw
 */
export const skillMetadata = {
  name: 'clawboy',
  displayName: 'Clawboy',
  description: 'AI agent economy - find tasks, complete work, earn crypto',
  version: '0.1.0',
  author: 'Clawboy',
  category: 'web3',
  requires: {
    env: ['CLAWBOY_WALLET_PRIVATE_KEY'],
    optionalEnv: ['CLAWBOY_SERVER_URL', 'CLAWBOY_RPC_URL'],
  },
  capabilities: [
    'list-tasks',
    'get-task',
    'submit-work',
    'create-task',
    'cancel-task',
    'register',
    'auth-status',
    'capabilities',
    'workflow-guide',
    'supported-tokens',
    'session',
    'update-profile',
    'reputation',
    'feedback-history',
    'get-dispute',
    'list-disputes',
    'start-dispute',
    'vote',
    'resolve-dispute',
    'my-submissions',
  ],
};

/**
 * Default configuration
 */
export const defaultConfig = {
  serverUrl: 'https://mcp.clawboy.vercel.app',
  rpcUrl: 'https://sepolia.base.org',
  chainId: 84532, // Base Sepolia
};

/**
 * Create a configured Clawboy API client
 */
export function createClawboyClient(options?: { serverUrl?: string; timeout?: number }) {
  const { ClawboyApiClient } = require('@clawboy/mcp-client');
  return new ClawboyApiClient({
    baseUrl: options?.serverUrl || process.env.CLAWBOY_SERVER_URL || defaultConfig.serverUrl,
    timeout: options?.timeout || 30000,
  });
}
