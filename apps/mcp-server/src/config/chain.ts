/**
 * Chain Configuration
 *
 * Centralized chain ID management. Validates and caches the chain ID
 * from environment variables. Fails fast in production if not configured.
 */

let cachedChainId: number | null = null;

/**
 * Get the chain ID for blockchain operations.
 *
 * In production: requires CHAIN_ID env var to be set, throws if missing.
 * In non-production: defaults to 84532 (Base Sepolia) if not set.
 */
export function getChainId(): number {
  if (cachedChainId !== null) {
    return cachedChainId;
  }

  const envChainId = process.env.CHAIN_ID;

  if (!envChainId) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        'FATAL: CHAIN_ID environment variable is required in production. ' +
          'Set it to the target chain ID (e.g., 8453 for Base mainnet, 84532 for Base Sepolia).'
      );
      process.exit(1);
    }
    // Default to Base Sepolia for development/test
    cachedChainId = 84532;
    return cachedChainId;
  }

  const parsed = parseInt(envChainId, 10);
  if (isNaN(parsed) || parsed <= 0) {
    console.error(`FATAL: Invalid CHAIN_ID value: "${envChainId}". Must be a positive integer.`);
    process.exit(1);
  }

  cachedChainId = parsed;
  return cachedChainId;
}

/**
 * Reset cached chain ID (for testing only)
 */
export function resetChainIdCache(): void {
  cachedChainId = null;
}
