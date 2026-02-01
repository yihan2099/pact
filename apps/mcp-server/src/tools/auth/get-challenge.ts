import { generateChallenge } from '../../auth/wallet-signature';

/**
 * Input for auth_get_challenge tool
 */
export interface GetChallengeInput {
  walletAddress: string;
}

/**
 * Output from auth_get_challenge tool
 */
export interface GetChallengeOutput {
  challenge: string;
  nonce: string;
  expiresAt: number;
  message: string;
}

/**
 * Tool definition for auth_get_challenge
 */
export const getChallengeToolDef = {
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
};

/**
 * Handler for auth_get_challenge tool
 */
export async function getChallengeHandler(
  args: unknown
): Promise<GetChallengeOutput> {
  const input = args as GetChallengeInput;

  // Validate wallet address format
  if (!input.walletAddress || !input.walletAddress.startsWith('0x')) {
    throw new Error('Invalid wallet address format. Must start with 0x');
  }

  if (input.walletAddress.length !== 42) {
    throw new Error('Invalid wallet address length. Must be 42 characters');
  }

  const walletAddress = input.walletAddress as `0x${string}`;

  // Generate challenge
  const { challenge, nonce, expiresAt } = generateChallenge(walletAddress);

  return {
    challenge,
    nonce,
    expiresAt,
    message:
      'Sign this challenge message with your wallet, then call auth_verify with the signature.',
  };
}

export const getChallengeTool = {
  definition: getChallengeToolDef,
  handler: getChallengeHandler,
};
