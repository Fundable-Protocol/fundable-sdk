# @fundable/sdk

Multichain TypeScript SDK for integrating Fundable token streams and
distributions. Stellar is the first implemented chain adapter; the public
domain types intentionally contain no Soroban-specific values so an EVM
adapter can be added without changing application code.

**Documentation:** [Fundable SDK on GitBook](https://fundable-finance.gitbook.io/fundable-finance-docs/)

> The `0.x` API remains under active development. Review release notes before
> upgrading between minor versions.

Detailed, GitBook-ready guides live in [`docs/`](./docs):

- [Documentation home](./docs/README.md)
- [Getting started](./docs/getting-started.md)
- [Configuration](./docs/configuration.md)
- [Flow streams](./docs/flows.md)
- [Transactions and authorization](./docs/transactions.md)
- [Sponsored transactions](./docs/sponsorship.md)
- [Example implementations](./docs/examples.md)
- [Backend indexing](./docs/backend-indexing.md)
- [Multichain architecture](./docs/multichain-architecture.md)
- [Generated binding provenance](./docs/generated-bindings.md)
- [Router, Stream NFT, and Paymaster development](./docs/router-paymaster.md)
- [API reference](./docs/api-reference.md)
- [Troubleshooting and versioning](./docs/troubleshooting-and-versioning.md)

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
    router: "C...",
    streamNft: "C...",
    distributor: "C...",
  },
  sponsorship: { backendUrl: "https://api.fundable.finance" },
});
```

The top-level client exposes Flow, Router, Stream NFT, Distributor, and sponsorship capability
groups when their contract IDs are configured:

```ts
const stream = await fundable.flows.getStream("42");
const withdrawable = await fundable.flows.getWithdrawableAmount("42");
```

Create NFT-backed Flow and Lockup streams through the Router:

```ts
const lockup = await fundable.router?.createLockup({
  sender: "G...",
  recipient: "G...",
  token: { address: "C...", decimals: 7 },
  totalAmount: 1_000_000_000n,
  startTime: new Date(),
  endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
  cancelable: true,
});
```

Create token distributions and claim tokens using Merkle proofs:

```ts
import { generateDistributionMerkleTree } from "@fundable/sdk/stellar";

const claims = [
  { claimant: "G...", amount: 1_000_000n },
  { claimant: "G...", amount: 2_000_000n },
];

const { merkleRoot, totalAmount, leafCount, tree } =
  generateDistributionMerkleTree(claims);

// Create distribution on-chain
const tx = await fundable.distributor?.createDistribution({
  creator: "G...",
  token: "C...",
  merkleRoot,
  totalAmount,
  leafCount,
  title: "Airdrop 2026",
  ipfsHash: "Qm...",
});

// Claimant claims tokens with proof
const proof = tree.getProof("G...", 1_000_000n);
const claimTx = await fundable.distributor?.claim({
  claimant: "G...",
  distributionId: 1n,
  amount: 1_000_000n,
  merkleProof: proof,
});
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

Fundable's NFT-backed creation workflow goes through `fundable.router`. The
`fundable.streamNft` group exposes NFT ownership and transfer policy.
`fundable.distributor` handles Merkle-based token distributions and claims.
`fundable.sponsorship` implements the production backend-mediated fee flow.
The legacy `fundable.paymaster` group is deprecated and retained only for
migration compatibility.

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
