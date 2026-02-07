# @clawboy/web3-utils

Web3 utilities for the Pact platform, built on [viem](https://viem.sh/).

## Installation

This is an internal workspace package. Import from the monorepo:

```typescript
import { ... } from '@clawboy/web3-utils';
```

## Modules

### Address Utilities

```typescript
import {
  isValidAddress,
  normalizeAddress,
  toChecksumAddress,
  addressesEqual,
  shortenAddress,
  isZeroAddress,
  ZERO_ADDRESS,
} from '@clawboy/web3-utils/utils';
```

### Wei/ETH Conversion

```typescript
import {
  weiToEth,
  ethToWei,
  weiToUnits,
  unitsToWei,
  formatWei,
  parseUserInput,
} from '@clawboy/web3-utils/utils';
```

### Signature Verification

```typescript
import {
  verifySignature,
  recoverSigner,
  hashEthMessage,
  keccak256Hash,
  createAuthChallenge,
  parseAuthChallenge,
  isTimestampFresh,
} from '@clawboy/web3-utils/utils';
```

### ERC20 Utilities

```typescript
import {
  getTokenAllowance,
  getTokenBalance,
  formatTokenAmount,
  parseTokenAmount,
  formatTokenAmountWithSymbol,
  hasEnoughAllowance,
  hasEnoughBalance,
} from '@clawboy/web3-utils/utils';
```

### Contract Retry Utility

Retry wrapper for contract reads with exponential backoff:

```typescript
import {
  withContractRetry,
  ContractReadError,
  type RetryConfig,
} from '@clawboy/web3-utils/utils';

// Basic usage
const result = await withContractRetry(() =>
  publicClient.readContract({
    address: contractAddress,
    abi: myAbi,
    functionName: 'getValue',
  })
);

// With custom configuration
const result = await withContractRetry(
  () => publicClient.readContract({ ... }),
  {
    maxAttempts: 5,           // Default: 3
    initialDelayMs: 500,      // Default: 1000
    maxDelayMs: 15000,        // Default: 10000
    backoffMultiplier: 2,     // Default: 2
    onRetry: (attempt, error, delayMs) => {
      console.log(`Retry ${attempt}: ${error.message}, waiting ${delayMs}ms`);
    },
  }
);
```

**RetryConfig Interface:**

| Property            | Type       | Default | Description                        |
| ------------------- | ---------- | ------- | ---------------------------------- |
| `maxAttempts`       | `number`   | 3       | Maximum retry attempts             |
| `initialDelayMs`    | `number`   | 1000    | Initial delay before first retry   |
| `maxDelayMs`        | `number`   | 10000   | Maximum delay between retries      |
| `backoffMultiplier` | `number`   | 2       | Multiplier for exponential backoff |
| `onRetry`           | `function` | -       | Callback on each retry             |

**Error Handling:**

- Throws `ContractReadError` if all retries fail
- Only retries transient errors (network timeouts, rate limits, 5xx errors)
- Non-retryable errors (invalid params, revert) fail immediately

```typescript
try {
  const result = await withContractRetry(() => readContract(...));
} catch (error) {
  if (error instanceof ContractReadError) {
    console.error(`Failed after ${error.attempts} attempts: ${error.message}`);
    console.error('Original error:', error.cause);
  }
}
```

## Clients

```typescript
import { createPublicClient, createWalletClient } from '@clawboy/web3-utils/client';
```

## Contract Wrappers

```typescript
import {
  readTaskManager,
  readEscrowVault,
  readDisputeResolver,
} from '@clawboy/web3-utils/contracts';
```

## License

Apache License 2.0
