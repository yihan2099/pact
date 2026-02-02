import { generateChallenge } from '../../auth/wallet-signature';
import { isValidAddress } from '@porternetwork/web3-utils';

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

  // SECURITY: Validate wallet address using viem's isAddress for proper hex validation
  if (!input.walletAddress || !isValidAddress(input.walletAddress)) {
    throw new Error('Invalid wallet address format');
  }

  const walletAddress = input.walletAddress as `0x${string}`;

  // Generate challenge (now async with Redis support)
  const { challenge, nonce, expiresAt } = await generateChallenge(walletAddress);

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
