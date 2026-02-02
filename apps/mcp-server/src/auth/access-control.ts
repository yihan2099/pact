import type { ServerContext } from '../server';
import { isAgentRegistered } from '@porternetwork/web3-utils';
import { updateSessionRegistration } from './session-manager';

/**
 * Access level requirements for tools
 * Note: 'verifier' level removed - no longer needed in competitive model
 */
export type AccessLevel = 'public' | 'authenticated' | 'registered';

/**
 * Tool access requirements mapping
 * Defines what level of authentication/registration is required for each tool
 */
export const toolAccessRequirements: Record<string, AccessLevel> = {
  // Public tools (no auth required)
  list_tasks: 'public',
  get_task: 'public',
  auth_get_challenge: 'public',
  auth_verify: 'public',
  auth_session: 'public',

  // Requires authentication (valid session, may not be registered)
  get_my_submissions: 'authenticated',
  register_agent: 'authenticated',

  // Requires registration (must be registered on-chain)
  create_task: 'registered',
  cancel_task: 'registered',
  submit_work: 'registered',
  update_profile: 'registered',

  // Dispute tools
  get_dispute: 'public',
  list_disputes: 'public',
  start_dispute: 'registered',
  submit_vote: 'registered',
  resolve_dispute: 'authenticated',
};

/**
 * Access check result
 */
export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a context has access to a tool (synchronous check)
 */
export function checkAccess(
  toolName: string,
  context: ServerContext
): AccessCheckResult {
  const requiredLevel = toolAccessRequirements[toolName];

  // Unknown tool - deny by default
  if (!requiredLevel) {
    return {
      allowed: false,
      reason: `Unknown tool: ${toolName}`,
    };
  }

  // Public tools always allowed
  if (requiredLevel === 'public') {
    return { allowed: true };
  }

  // Check authentication
  if (!context.isAuthenticated) {
    return {
      allowed: false,
      reason: 'Authentication required. Call auth_get_challenge and auth_verify first.',
    };
  }

  // Authenticated level - just need a valid session
  if (requiredLevel === 'authenticated') {
    return { allowed: true };
  }

  // Check registration - note: this may be stale, use checkAccessWithRegistrationRefresh for registered tools
  if (!context.isRegistered) {
    return {
      allowed: false,
      reason: 'Agent must be registered on-chain to use this tool.',
    };
  }

  // Registered level - need to be registered
  if (requiredLevel === 'registered') {
    return { allowed: true };
  }

  // Fallback - deny
  return {
    allowed: false,
    reason: 'Access denied',
  };
}

/**
 * Check access with on-chain registration refresh for registered-level tools
 * This allows agents who register mid-session to access registered tools
 */
export async function checkAccessWithRegistrationRefresh(
  toolName: string,
  context: ServerContext
): Promise<AccessCheckResult & { registrationUpdated?: boolean }> {
  const requiredLevel = toolAccessRequirements[toolName];

  // For non-registered tools, use the fast synchronous check
  if (requiredLevel !== 'registered') {
    return checkAccess(toolName, context);
  }

  // Unknown tool - deny by default
  if (!requiredLevel) {
    return {
      allowed: false,
      reason: `Unknown tool: ${toolName}`,
    };
  }

  // Check authentication first
  if (!context.isAuthenticated) {
    return {
      allowed: false,
      reason: 'Authentication required. Call auth_get_challenge and auth_verify first.',
    };
  }

  // If already registered in session, allow
  if (context.isRegistered) {
    return { allowed: true };
  }

  // Session says not registered - re-check on-chain
  // This handles the case where an agent registered mid-session
  try {
    const chainId = parseInt(process.env.CHAIN_ID || '84532', 10);
    const isNowRegistered = await isAgentRegistered(context.callerAddress, chainId);

    if (isNowRegistered && context.sessionId) {
      // Update the session to reflect new registration status
      await updateSessionRegistration(context.sessionId, true);

      return {
        allowed: true,
        registrationUpdated: true,
      };
    }
  } catch (error) {
    console.warn('Failed to check on-chain registration:', error);
    // Fall through to deny if we can't verify
  }

  return {
    allowed: false,
    reason: 'Agent must be registered on-chain to use this tool.',
  };
}

/**
 * Get the access level required for a tool
 */
export function getToolAccessLevel(toolName: string): AccessLevel | undefined {
  return toolAccessRequirements[toolName];
}

/**
 * Check if a tool is public (no auth required)
 */
export function isPublicTool(toolName: string): boolean {
  return toolAccessRequirements[toolName] === 'public';
}
