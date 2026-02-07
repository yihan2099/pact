export { getChallengeTool, getChallengeToolDef, getChallengeHandler } from './get-challenge';
export type { GetChallengeInput, GetChallengeOutput } from './get-challenge';

export {
  verifySignatureTool,
  verifySignatureToolDef,
  verifySignatureHandler,
} from './verify-signature';
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
      'Start authentication by requesting a challenge message. Sign it with your wallet private key, then call auth_verify. This proves you control the wallet without exposing your key.',
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
      'Complete authentication by submitting your signed challenge. Returns a sessionId (valid 24 hours) that unlocks submitting work, creating tasks, and disputing.',
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
      'Check your current session status or invalidate it to log out. Sessions expire after 24 hours.',
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
