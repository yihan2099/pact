import { getSession, invalidateSession } from '../../auth/session-manager';
import type { AgentTier } from '@porternetwork/shared-types';

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
  tier?: AgentTier | null;
  isVerifier?: boolean;
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
  description:
    'Check the status of an authentication session or invalidate it.',
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
 */
export async function getSessionHandler(
  args: unknown
): Promise<GetSessionOutput> {
  const input = args as GetSessionInput;

  if (!input.sessionId) {
    throw new Error('sessionId is required');
  }

  const action = input.action || 'get';

  if (action === 'invalidate') {
    const wasInvalidated = invalidateSession(input.sessionId);
    return {
      valid: false,
      message: wasInvalidated
        ? 'Session invalidated successfully'
        : 'Session not found or already invalidated',
    };
  }

  // Get session info
  const session = getSession(input.sessionId);

  if (!session) {
    return {
      valid: false,
      message: 'Session not found or expired',
    };
  }

  return {
    valid: true,
    walletAddress: session.walletAddress,
    tier: session.tier,
    isVerifier: session.isVerifier,
    isRegistered: session.isRegistered,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

export const getSessionTool = {
  definition: getSessionToolDef,
  handler: getSessionHandler,
};
