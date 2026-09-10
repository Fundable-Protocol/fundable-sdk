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
| `lockups` | Present when `contracts.lockup` is configured. |
| `router` | Present when `contracts.router` is configured. |
| `streamNft` | Present when `contracts.streamNft` is configured. |
| `sponsorship` | Present when `sponsorship.backendUrl` is configured. |
| `paymaster` | Deprecated; migration-only when `contracts.paymaster` is configured. |

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
| `ownerOf`, `statusOf`, `coreStreamId` | Canonical reads keyed by NFT token ID. |
| `getStream` | Owner, type, status, transferability, token ID, and core ID. |
| `voidFlow` | NFT-owner Flow void transaction. |

## Lockup client

| Method | Result |
| --- | --- |
| `cancel`, `renounce` | Sender-authorized Lockup transactions using a core stream ID. |
| `statusOf`, `isCancelable` | Current Lockup lifecycle and cancellation state. |
| `withdrawableAmount`, `refundableAmount` | Current amounts as `bigint`. |

## Stream NFT client

| Method | Result |
| --- | --- |
| `ownerOf` | Owner Stellar address. |
| `balanceOf` | Number of Stream NFTs owned as `bigint`. |
| `getStreamData` | `{ tokenId, streamId, streamKind }`. |
| `isTransferable` | Immutable on-chain transfer policy. |
| `transfer` | Assembled transfer transaction. |

## Sponsorship client

| Method | Result |
| --- | --- |
| `authenticate` | Signed-wallet backend session. |
| `quote` | Fee token, estimate, maximum, and conversion rate. |
| `build` | FeeForwarder transaction, user auth entry, and expiration. |
| `submit` | Durable IDs, status, transaction hash, and confirmed NFT token ID. |
| `isBuildExpired` | Whether a build must be rebuilt before signing or submission. |

`fundable.signSponsorshipAuthorization(build)` signs the backend-issued user
authorization entry with the configured wallet callback.

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
`TRANSACTION_FAILED`, `RPC_UNAVAILABLE`, `API_REQUEST_FAILED`,
`AUTHENTICATION_REQUIRED`, and `AUTHORIZATION_EXPIRED`. The underlying failure may be
available as `error.cause`; do not display raw provider responses to end users
without filtering sensitive data.
