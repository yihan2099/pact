export { getChallengeTool, getChallengeToolDef, getChallengeHandler } from './get-challenge';
export type { GetChallengeInput, GetChallengeOutput } from './get-challenge';

export { verifySignatureTool, verifySignatureToolDef, verifySignatureHandler } from './verify-signature';
export type { VerifySignatureInput, VerifySignatureOutput } from './verify-signature';

export { getSessionTool, getSessionToolDef, getSessionHandler } from './get-session';
export type { GetSessionInput, GetSessionOutput } from './get-session';

/**
 * All auth tool definitions for the tools listing
 */
export const authToolDefs = [
  {
    name: 'auth_get_challenge',
    description:
      'Get a challenge message to sign for authentication. Call this first, then sign the challenge with your wallet and call auth_verify.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Your wallet address (0x...)',
        },
      },
      required: ['walletAddress'],
    },
  },
  {
    name: 'auth_verify',
    description:
      'Verify a signed challenge to complete authentication. Returns a sessionId to include in subsequent tool calls.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Your wallet address (0x...)',
        },
        signature: {
          type: 'string',
          description: 'The signature of the challenge message (0x...)',
        },
        challenge: {
          type: 'string',
          description: 'The challenge message that was signed',
        },
      },
      required: ['walletAddress', 'signature', 'challenge'],
    },
  },
  {
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
  },
];
