/**
 * Get Capabilities Tool
 *
 * Returns available tools based on the current session state.
 * Provides dynamic discovery of what the user can do right now.
 */

import type { ServerContext } from '../../server';
import type { AccessState, ToolAvailability, ToolCategory } from '../types';
import { enhancedToolDefinitions } from './tool-metadata';
import { toolAccessRequirements, type AccessLevel } from '../../auth/access-control';

export interface GetCapabilitiesInput {
  sessionId?: string;
  category?: ToolCategory | 'all';
}

export interface GetCapabilitiesOutput {
  currentAccess: AccessState;
  tools: ToolAvailability[];
  nextSteps: string[];
}

/**
 * Determine current access level from context
 */
function getAccessState(context: ServerContext): AccessState {
  if (!context.isAuthenticated) {
    return {
      level: 'public',
      isRegistered: false,
    };
  }

  if (!context.isRegistered) {
    return {
      level: 'authenticated',
      walletAddress: context.callerAddress,
      isRegistered: false,
    };
  }

  return {
    level: 'registered',
    walletAddress: context.callerAddress,
    isRegistered: true,
  };
}

/**
 * Check if a tool is available given the current access level
 */
function isToolAvailable(
  requiredLevel: AccessLevel,
  currentLevel: AccessState['level']
): { available: boolean; reason?: string } {
  if (requiredLevel === 'public') {
    return { available: true };
  }

  if (requiredLevel === 'authenticated') {
    if (currentLevel === 'public') {
      return {
        available: false,
        reason: 'Requires authentication. Call auth_get_challenge and auth_verify first.',
      };
    }
    return { available: true };
  }

  if (requiredLevel === 'registered') {
    if (currentLevel === 'public') {
      return {
        available: false,
        reason: 'Requires authentication and on-chain registration.',
      };
    }
    if (currentLevel === 'authenticated') {
      return {
        available: false,
        reason: 'Requires on-chain registration. Call register_agent first.',
      };
    }
    return { available: true };
  }

  return { available: false, reason: 'Unknown access level' };
}

/**
 * Get next steps based on current access state
 */
function getNextSteps(accessState: AccessState): string[] {
  if (accessState.level === 'public') {
    return [
      'Call get_workflow_guide to learn about available roles and workflows',
      'Call auth_get_challenge with your wallet address to start authentication',
      'Browse tasks with list_tasks (no auth required)',
    ];
  }

  if (accessState.level === 'authenticated' && !accessState.isRegistered) {
    return [
      'Call register_agent to complete on-chain registration',
      'Browse tasks with list_tasks to find work',
      'Check your submissions with get_my_submissions',
    ];
  }

  return [
    'Browse open tasks with list_tasks to find work',
    'Submit work with submit_work for tasks matching your skills',
    'Check active disputes with list_disputes to participate in voting',
  ];
}

/**
 * Handler for get_capabilities tool
 */
export async function getCapabilitiesHandler(
  args: unknown,
  context: ServerContext
): Promise<GetCapabilitiesOutput> {
  const input = args as GetCapabilitiesInput;
  const categoryFilter = input?.category || 'all';

  const accessState = getAccessState(context);

  // Filter and transform tool definitions
  const tools: ToolAvailability[] = enhancedToolDefinitions
    .filter((tool) => categoryFilter === 'all' || tool.category === categoryFilter)
    .map((tool) => {
      const requiredLevel = toolAccessRequirements[tool.name] || 'public';
      const availability = isToolAvailable(requiredLevel, accessState.level);

      return {
        name: tool.name,
        description: tool.description,
        category: tool.category,
        accessLevel: tool.accessLevel,
        available: availability.available,
        reason: availability.reason,
      };
    });

  return {
    currentAccess: accessState,
    tools,
    nextSteps: getNextSteps(accessState),
  };
}

export const getCapabilitiesTool = {
  handler: getCapabilitiesHandler,
};
