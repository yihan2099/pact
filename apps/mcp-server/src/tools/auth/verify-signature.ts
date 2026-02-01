import { verifyChallengeSignature } from '../../auth/wallet-signature';
import { createSession } from '../../auth/session-manager';
import {
  isAgentRegistered,
  getAgentData,
  contractTierToAgentTier,
} from '@porternetwork/web3-utils';
import { AgentTier, AgentTierConfig } from '@porternetwork/shared-types';

/**
 * Input for auth_verify tool
 */
export interface VerifySignatureInput {
  walletAddress: string;
  signature: string;
  challenge: string;
}

/**
 * Output from auth_verify tool
 */
export interface VerifySignatureOutput {
  success: boolean;
  sessionId?: string;
  walletAddress?: string;
  tier?: AgentTier | null;
  isVerifier?: boolean;
  isRegistered?: boolean;
  expiresAt?: number;
  error?: string;
}

/**
 * Tool definition for auth_verify
 */
export const verifySignatureToolDef = {
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
};

/**
 * Handler for auth_verify tool
 */
export async function verifySignatureHandler(
  args: unknown
): Promise<VerifySignatureOutput> {
  const input = args as VerifySignatureInput;

  // Validate inputs
  if (!input.walletAddress?.startsWith('0x') || input.walletAddress.length !== 42) {
    throw new Error('Invalid wallet address format');
  }

  if (!input.signature?.startsWith('0x')) {
    throw new Error('Invalid signature format. Must start with 0x');
  }

  if (!input.challenge) {
    throw new Error('Challenge message is required');
  }

  const walletAddress = input.walletAddress as `0x${string}`;
  const signature = input.signature as `0x${string}`;

  // Verify the signature
  const verifyResult = await verifyChallengeSignature(
    walletAddress,
    signature,
    input.challenge
  );

  if (!verifyResult.valid) {
    return {
      success: false,
      error: verifyResult.error || 'Signature verification failed',
    };
  }

  // Check on-chain registration status
  let isRegistered = false;
  let tier: AgentTier | null = null;
  let isVerifier = false;

  try {
    isRegistered = await isAgentRegistered(walletAddress);

    if (isRegistered) {
      const agentData = await getAgentData(walletAddress);
      tier = contractTierToAgentTier(agentData.tier);

      // Check if agent can verify (Elite tier)
      const tierConfig = AgentTierConfig[tier];
      isVerifier = tierConfig?.canVerify ?? false;
    }
  } catch (error) {
    // If chain query fails, continue with unregistered status
    console.error('Failed to check on-chain registration:', error);
  }

  // Create session
  const { sessionId, session } = createSession(
    walletAddress,
    tier,
    isVerifier,
    isRegistered
  );

  return {
    success: true,
    sessionId,
    walletAddress: session.walletAddress,
    tier: session.tier,
    isVerifier: session.isVerifier,
    isRegistered: session.isRegistered,
    expiresAt: session.expiresAt,
  };
}

export const verifySignatureTool = {
  definition: verifySignatureToolDef,
  handler: verifySignatureHandler,
};
