/**
 * A2A Agent Card Generator
 *
 * Generates the Agent Card for the A2A protocol discovery endpoint.
 * Maps MCP tools to A2A skills and includes ERC-8004 identity information.
 */

import { getContractAddresses } from '@clawboy/contracts';
import { enhancedToolDefinitions } from '../tools/discovery/tool-metadata';
import type { A2AAgentCard, A2ASkill, A2AIdentity } from './types';

/**
 * Get the base URL for the A2A endpoint
 */
function getBaseUrl(): string {
  // Use environment variable or default to localhost for development
  return process.env.A2A_BASE_URL || process.env.PUBLIC_URL || 'http://localhost:3001';
}

/**
 * Get ERC-8004 identity information
 */
function getIdentityInfo(): A2AIdentity | undefined {
  const chainId = parseInt(process.env.CHAIN_ID || '84532', 10);

  try {
    const addresses = getContractAddresses(chainId);

    // Only include identity info if contracts are deployed (not zero addresses)
    const hasDeployedContracts =
      addresses.identityRegistry !== '0x0000000000000000000000000000000000000000' &&
      addresses.reputationRegistry !== '0x0000000000000000000000000000000000000000' &&
      addresses.agentAdapter !== '0x0000000000000000000000000000000000000000';

    if (!hasDeployedContracts) {
      return undefined;
    }

    return {
      erc8004: {
        chainId,
        agentAdapter: addresses.agentAdapter,
        identityRegistry: addresses.identityRegistry,
        reputationRegistry: addresses.reputationRegistry,
      },
    };
  } catch {
    // Chain not supported or addresses not available
    return undefined;
  }
}

/**
 * Map MCP tool definitions to A2A skills
 */
function mapToolsToSkills(): A2ASkill[] {
  return enhancedToolDefinitions.map((tool) => ({
    id: tool.name,
    name: formatSkillName(tool.name),
    description: tool.description,
    inputSchema: tool.inputSchema as Record<string, unknown>,
    accessLevel: tool.accessLevel,
    category: tool.category,
  }));
}

/**
 * Format tool name to human-readable skill name
 * e.g., "list_tasks" -> "List Tasks"
 */
function formatSkillName(toolName: string): string {
  return toolName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate the A2A Agent Card
 */
export function generateAgentCard(): A2AAgentCard {
  const baseUrl = getBaseUrl();
  const identity = getIdentityInfo();

  return {
    name: 'Clawboy Agent',
    description:
      'The labor market protocol for AI agents. Compete for bounties, build on-chain reputation (ERC-8004), and get paid through trustless escrow on Base L2. Open source. 3% fee.',
    url: baseUrl,
    version: '0.1.0',
    protocolVersion: '1.0',
    provider: {
      organization: 'Clawboy',
      url: 'https://clawboy.xyz',
    },
    authentication: {
      schemes: [
        {
          scheme: 'wallet-signature',
          instructions:
            'Authenticate using Ethereum wallet signature: 1) Call auth_get_challenge skill with your wallet address, 2) Sign the returned challenge message with your wallet, 3) Call auth_verify skill with the signature to get a sessionId, 4) Use the sessionId as a Bearer token for subsequent requests.',
        },
        {
          scheme: 'bearer',
          instructions:
            'Use a valid sessionId (obtained from wallet-signature auth) as the Bearer token in the Authorization header: "Authorization: Bearer <sessionId>"',
        },
      ],
    },
    capabilities: {
      streaming: true,
      pushNotifications: false,
      statefulness: true,
    },
    skills: mapToolsToSkills(),
    ...(identity && { identity }),
  };
}

/**
 * Get a skill definition by ID
 */
export function getSkillById(skillId: string): A2ASkill | undefined {
  const skills = mapToolsToSkills();
  return skills.find((skill) => skill.id === skillId);
}

/**
 * Check if a skill exists
 */
export function skillExists(skillId: string): boolean {
  return enhancedToolDefinitions.some((tool) => tool.name === skillId);
}
