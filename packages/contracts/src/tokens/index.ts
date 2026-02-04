/**
 * Supported Token Configuration
 *
 * Whitelist of supported tokens for task bounties.
 * Using symbols instead of raw addresses provides a safer UX.
 */

/** Zero address constant for ETH */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export interface TokenConfig {
  /** Token symbol (e.g., "USDC") */
  symbol: string;
  /** Human-readable name */
  name: string;
  /** Token decimals (ETH=18, USDC=6) */
  decimals: number;
  /** Contract address (zero address for native ETH) */
  address: `0x${string}`;
}

/**
 * Supported tokens by chain ID
 * Key: chain ID
 * Value: Map of symbol -> TokenConfig
 */
export const SUPPORTED_TOKENS: Record<number, Record<string, TokenConfig>> = {
  // Base Mainnet
  8453: {
    ETH: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      address: ZERO_ADDRESS,
    },
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    },
    USDT: {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    },
    DAI: {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    },
  },
  // Base Sepolia
  84532: {
    ETH: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      address: ZERO_ADDRESS,
    },
    // Note: These are testnet token addresses - may need updating
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin (Test)',
      decimals: 6,
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
    },
  },
  // Local Anvil
  31337: {
    ETH: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      address: ZERO_ADDRESS,
    },
    // Mock USDC for local testing - deterministic Anvil address (deployed after core contracts)
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin (Mock)',
      decimals: 6,
      address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', // Deterministic Anvil address
    },
  },
};

/**
 * Get token configuration by symbol
 * @param chainId - The chain ID
 * @param symbol - Token symbol (case-insensitive)
 * @returns Token configuration or undefined if not found
 */
export function getTokenBySymbol(chainId: number, symbol: string): TokenConfig | undefined {
  const chainTokens = SUPPORTED_TOKENS[chainId];
  if (!chainTokens) return undefined;
  return chainTokens[symbol.toUpperCase()];
}

/**
 * Get token configuration by address
 * @param chainId - The chain ID
 * @param address - Token contract address
 * @returns Token configuration or undefined if not found
 */
export function getTokenByAddress(chainId: number, address: string): TokenConfig | undefined {
  const chainTokens = SUPPORTED_TOKENS[chainId];
  if (!chainTokens) return undefined;

  const normalizedAddress = address.toLowerCase();
  return Object.values(chainTokens).find(
    (token) => token.address.toLowerCase() === normalizedAddress
  );
}

/**
 * Get all supported tokens for a chain
 * @param chainId - The chain ID
 * @returns Array of token configurations
 */
export function getSupportedTokens(chainId: number): TokenConfig[] {
  const chainTokens = SUPPORTED_TOKENS[chainId];
  if (!chainTokens) return [];
  return Object.values(chainTokens);
}

/**
 * Check if a token is supported
 * @param chainId - The chain ID
 * @param symbolOrAddress - Token symbol or address
 * @returns True if the token is supported
 */
export function isTokenSupported(chainId: number, symbolOrAddress: string): boolean {
  // Check if it's a symbol
  if (getTokenBySymbol(chainId, symbolOrAddress)) return true;
  // Check if it's an address
  if (symbolOrAddress.startsWith('0x') && getTokenByAddress(chainId, symbolOrAddress)) return true;
  return false;
}

/**
 * Resolve a token identifier (symbol or address) to its configuration
 * @param chainId - The chain ID
 * @param symbolOrAddress - Token symbol or address
 * @returns Token configuration or undefined
 */
export function resolveToken(chainId: number, symbolOrAddress: string): TokenConfig | undefined {
  // First try as symbol
  const bySymbol = getTokenBySymbol(chainId, symbolOrAddress);
  if (bySymbol) return bySymbol;

  // Then try as address
  if (symbolOrAddress.startsWith('0x')) {
    return getTokenByAddress(chainId, symbolOrAddress);
  }

  return undefined;
}

/**
 * Check if an address represents native ETH (zero address)
 */
export function isNativeToken(address: string): boolean {
  return address.toLowerCase() === ZERO_ADDRESS.toLowerCase();
}
