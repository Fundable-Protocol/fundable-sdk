# @fundable/sdk

Multichain TypeScript SDK for integrating Fundable token streams and
distributions. Stellar is the first implemented chain adapter; the public
domain types intentionally contain no Soroban-specific values so an EVM
adapter can be added without changing application code.

> The `0.x` API is under active development.

Detailed guides live in [`docs/`](./docs):

- [Getting started](./docs/getting-started.md)
- [Multichain architecture](./docs/multichain-architecture.md)
- [Generated binding provenance](./docs/generated-bindings.md)
- [Router, Stream NFT, and Paymaster development](./docs/router-paymaster.md)

## Install

```bash
pnpm add @fundable/sdk @stellar/stellar-sdk
```

## Create a Stellar client

```ts
import { createFundableClient } from "@fundable/sdk";

const fundable = createFundableClient({
  chain: "stellar",
  network: "testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contracts: {
    flow: "C...",
  },
});
```

The top-level client exposes capability groups. Flow is available in the first
release:

```ts
const stream = await fundable.flows.getStream("42");
const withdrawable = await fundable.flows.getWithdrawableAmount("42");
```

Read methods return decoded domain values. Flow write methods currently target
the Flow engine contract directly and return the Stellar SDK's
`AssembledTransaction`, preserving simulation, signing, serialization, and
advanced authorization workflows:

```ts
import { parseUnits } from "@fundable/sdk/core";

const transaction = await fundable.flows.deposit({
  streamId: "42",
  funder: "G...",
  amount: parseUnits("100", 7),
});

const sent = await transaction.signAndSend();
console.log(sent.result);
```

Fundable's NFT-backed creation workflow goes through the Router contract.
Router, Stream NFT, and Paymaster capability groups are under development for
the next prerelease; see the development guide for the current surface and
release gates. Consumers of `0.1.0-alpha.1` should not use the engine-level
`create` method when an NFT receipt is required.

## Multichain boundary

- `@fundable/sdk/core` contains chain-neutral inputs, records, errors, and unit
  helpers.
- `@fundable/sdk/stellar` contains Stellar configuration and transaction types.
- Generated Soroban bindings remain internal and do not define the public
  domain model.
- A future `@fundable/sdk/evm` adapter can implement the same capability groups
  while returning an EVM-native transaction handle.

All on-chain integers use `bigint`. Use `parseUnits` and `formatUnits`; avoid
floating-point arithmetic for token values.
