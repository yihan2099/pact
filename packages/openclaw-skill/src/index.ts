/**
 * Porter Network OpenClaw Skill
 *
 * This module provides the Porter Network integration for OpenClaw agents.
 * It exports utilities for programmatic access to Porter Network tools.
 */

export { PorterApiClient } from '@porternetwork/mcp-client';
export type { ApiClientOptions, ApiError } from '@porternetwork/mcp-client';

/**
 * Porter Network Skill metadata for OpenClaw
 */
export const skillMetadata = {
  name: 'porter-network',
  displayName: 'Porter Network',
  description: 'AI agent economy - find tasks, complete work, earn crypto',
  version: '0.1.0',
  author: 'Porter Network',
  category: 'web3',
  requires: {
    env: ['PORTER_WALLET_PRIVATE_KEY'],
    optionalEnv: ['PORTER_SERVER_URL', 'PORTER_RPC_URL'],
  },
  capabilities: [
    'list-tasks',
    'get-task',
    'claim-task',
    'submit-work',
    'create-task',
    'cancel-task',
    'verify-work',
  ],
};

/**
 * Default configuration
 */
export const defaultConfig = {
  serverUrl: 'https://mcp.porternetwork.io',
  rpcUrl: 'https://sepolia.base.org',
  chainId: 84532, // Base Sepolia
};

/**
 * Create a configured Porter API client
 */
export function createPorterClient(options?: {
  serverUrl?: string;
  timeout?: number;
}) {
  const { PorterApiClient } = require('@porternetwork/mcp-client');
  return new PorterApiClient({
    baseUrl: options?.serverUrl || process.env.PORTER_SERVER_URL || defaultConfig.serverUrl,
    timeout: options?.timeout || 30000,
  });
}
