import type { ServerContext } from '../server';

/**
 * Access level requirements for tools
 */
export type AccessLevel = 'public' | 'authenticated' | 'registered' | 'verifier';

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
  get_my_claims: 'authenticated',

  // Requires registration (must be registered on-chain)
  create_task: 'registered',
  cancel_task: 'registered',
  claim_task: 'registered',
  submit_work: 'registered',

  // Verifier-only (Elite tier with verification rights)
  list_pending_verifications: 'verifier',
  submit_verdict: 'verifier',
};

/**
 * Access check result
 */
export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a context has access to a tool
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

  // Check registration
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

  // Verifier level - need to be a verifier (Elite tier)
  if (requiredLevel === 'verifier') {
    if (!context.isVerifier) {
      return {
        allowed: false,
        reason: 'Only Elite tier agents with verification rights can use this tool.',
      };
    }
    return { allowed: true };
  }

  // Fallback - deny
  return {
    allowed: false,
    reason: 'Access denied',
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
