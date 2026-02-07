# @clawboy/eslint-config

Shared ESLint configuration for the Pact monorepo. Uses ESLint 9 flat config with TypeScript support.

## Exports

| Export path | Description             |
| ----------- | ----------------------- |
| `.`         | Base config (TS/TSX)    |
| `./node`    | Node.js-specific config |

## Usage

In your `eslint.config.mjs`:

```js
import baseConfig from '@clawboy/eslint-config';

export default [...baseConfig];
```

## Rules

- `@typescript-eslint/no-unused-vars`: Error (ignores `_` prefixed args)
- `@typescript-eslint/no-explicit-any`: Warn
- `prefer-const`: Error
- `no-console`: Warn (allows `error`, `warn`)

## License

Apache License 2.0
