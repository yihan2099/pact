/**
 * Get Supported Tokens Tool
 *
 * Returns the list of supported tokens for task bounties on the current chain.
 * Helps agents discover what tokens they can use when creating tasks.
 */

import { getSupportedTokens, type TokenConfig } from '@clawboy/contracts';
import { getChainId } from '../../config/chain';

export interface GetSupportedTokensInput {
  // No input required - uses current chain from environment
}

export interface GetSupportedTokensOutput {
  chainId: number;
  tokens: Array<{
    symbol: string;
    name: string;
    address: string;
    decimals: number;
  }>;
  note: string;
}

/**
 * Handler for get_supported_tokens tool
 */
export async function getSupportedTokensHandler(): Promise<GetSupportedTokensOutput> {
  const chainId = getChainId();
  const tokens = getSupportedTokens(chainId);

  return {
    chainId,
    tokens: tokens.map((token: TokenConfig) => ({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      decimals: token.decimals,
    })),
    note: 'Use the symbol (e.g., "USDC") when creating tasks. ETH uses address 0x0000...0000.',
  };
}

export const getSupportedTokensTool = {
  name: 'get_supported_tokens',
  description:
    'Get supported tokens for task bounties. Returns ETH and stablecoins (USDC, USDT, DAI) available on this chain.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
  handler: getSupportedTokensHandler,
};
