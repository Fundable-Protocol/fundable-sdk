# API reference

The package exposes three import boundaries:

```ts
import { createFundableClient } from "@fundable/sdk";
import { parseUnits, formatUnits, FundableError } from "@fundable/sdk/core";
import type { StellarFundableClientConfig } from "@fundable/sdk/stellar";
```

## Top-level client

`createFundableClient(config)` returns `StellarFundableClient` for
`chain: "stellar"`. Its capability groups are:

| Property | Availability |
| --- | --- |
| `flows` | Always present; `contracts.flow` is required. |
| `router` | Present when `contracts.router` is configured. |
| `streamNft` | Present when `contracts.streamNft` is configured. |
| `paymaster` | Present when `contracts.paymaster` is configured. |

## Flow client

| Method | Result |
| --- | --- |
| `create` | Assembled transaction returning stream ID. |
| `createAndDeposit` | Assembled transaction returning stream ID. |
| `deposit`, `withdraw`, `pause`, `restart`, `adjustRate`, `refund`, `void` | Assembled state-changing transaction. |
| `withdrawMax`, `refundMax` | Assembled transaction returning the affected amount. |
| `getStream` | Normalized `FlowRecord`. |
| `getStatus` | Normalized `FlowStatus`. |
| Amount and debt getters | `bigint`. |

## Router client

| Method | Result |
| --- | --- |
| `createFlow` | Assembled transaction returning Stream NFT token ID. |
| `createLockup` | Assembled transaction returning Stream NFT token ID. |
| `withdraw` | Assembled transaction for an amount and token ID. |
| `withdrawMax` | Assembled transaction returning the withdrawn amount. |

## Stream NFT client

| Method | Result |
| --- | --- |
| `ownerOf` | Owner Stellar address. |
| `balanceOf` | Number of Stream NFTs owned as `bigint`. |
| `getStreamData` | `{ tokenId, streamId, streamKind }`. |
| `transfer` | Assembled transfer transaction. |

## Paymaster client

| Method | Result |
| --- | --- |
| `isFeeTokenAllowed` | `boolean`. |
| `forward` | Assembled transaction returning the target result. |

`forward` requires the user, fee token and bounded fee amounts, expiration
ledger, fee recipient, target contract, function name, and raw Soroban
arguments. It is an advanced API: construct arguments from a reviewed target
contract specification and never forward an arbitrary function supplied by an
untrusted user.

## Core values

- `parseUnits(value, decimals)` converts a decimal string to exact `bigint`
  base units.
- `formatUnits(value, decimals)` formats base units without floating-point
  arithmetic.
- `toUnixSeconds(value, label?)` normalizes a `Date` or non-negative `bigint`.
- `CHAIN_FAMILIES`, `FLOW_STATUSES`, and `STREAM_KINDS` provide stable string
  constants.

## Errors

SDK validation and adapter failures use `FundableError`:

```ts
try {
  await fundable.flows.getStream("42");
} catch (error) {
  if (error instanceof FundableError) {
    console.error(error.code, error.chain, error.message);
  }
}
```

The stable error codes are `INVALID_ARGUMENT`, `INVALID_CONFIGURATION`,
`UNSUPPORTED_CHAIN`, `UNSUPPORTED_CAPABILITY`, `SIMULATION_FAILED`,
`TRANSACTION_FAILED`, and `RPC_UNAVAILABLE`. The underlying failure may be
available as `error.cause`; do not display raw provider responses to end users
without filtering sensitive data.
