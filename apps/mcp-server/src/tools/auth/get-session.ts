import { getSession, invalidateSession } from '../../auth/session-manager';
import type { ServerContext } from '../../server';

/**
 * Input for auth_session tool
 */
export interface GetSessionInput {
  sessionId: string;
  action?: 'get' | 'invalidate';
}

/**
 * Output from auth_session tool
 */
export interface GetSessionOutput {
  valid: boolean;
  walletAddress?: string;
  isRegistered?: boolean;
  createdAt?: number;
  expiresAt?: number;
  message?: string;
}

/**
 * Tool definition for auth_session
 */
export const getSessionToolDef = {
  name: 'auth_session',
  description: 'Check the status of an authentication session or invalidate it.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: {
        type: 'string',
        description: 'The session ID to check',
      },
      action: {
        type: 'string',
        enum: ['get', 'invalidate'],
        description: 'Action to perform: get session info or invalidate it (default: get)',
      },
    },
    required: ['sessionId'],
  },
};

/**
 * Handler for auth_session tool
 *
 * SECURITY: Session invalidation requires authentication and ownership verification.
 * Users can only invalidate their own sessions to prevent DoS attacks.
 */
export async function getSessionHandler(
  args: unknown,
  context?: ServerContext
): Promise<GetSessionOutput> {
  const input = args as GetSessionInput;

  if (!input.sessionId) {
    throw new Error('sessionId is required');
  }

  const action = input.action || 'get';

  if (action === 'invalidate') {
    // SECURITY: Invalidation requires authentication
    if (!context?.isAuthenticated) {
      return {
        valid: false,
        message: 'Authentication required to invalidate sessions',
      };
    }

    // SECURITY: Users can only invalidate their own sessions
    // Check if the session being invalidated belongs to the authenticated user
    const targetSession = await getSession(input.sessionId);
    if (!targetSession) {
      return {
        valid: false,
        message: 'Session not found or already invalidated',
      };
    }

    // Verify ownership: the caller's wallet must match the target session's wallet
    if (targetSession.walletAddress.toLowerCase() !== context.callerAddress.toLowerCase()) {
      return {
        valid: false,
        message: 'You can only invalidate your own sessions',
      };
    }

    const wasInvalidated = await invalidateSession(input.sessionId);
    return {
      valid: false,
      message: wasInvalidated
        ? 'Session invalidated successfully'
        : 'Session not found or already invalidated',
    };
  }

  // Get session info (public - no auth required for checking session status)
  const session = await getSession(input.sessionId);

  if (!session) {
    return {
      valid: false,
      message: 'Session not found or expired',
    };
  }

  return {
    valid: true,
    walletAddress: session.walletAddress,
    isRegistered: session.isRegistered,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

export const getSessionTool = {
  definition: getSessionToolDef,
  handler: getSessionHandler,
};
