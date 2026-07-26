# Getting started

## Installation

```bash
pnpm add @fundable/sdk @stellar/stellar-sdk
```

The SDK requires Node.js 20 or newer. npm and Yarn can install the same public
package:

```bash
npm install @fundable/sdk @stellar/stellar-sdk
```

## Configure Stellar

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

Use environment-specific deployment addresses rather than copying the
placeholders. See [Configuration](configuration.md) for optional Router, Stream
NFT, Paymaster, signing, and server settings.

Read calls return decoded values:

```ts
const stream = await fundable.flows.getStream("42");
const withdrawable = await fundable.flows.getWithdrawableAmount("42");
```

Write calls return a Stellar `AssembledTransaction`, allowing the application
to choose its wallet and authorization workflow. Configure the client with a
connected public key and signing callbacks before submission:

```ts
import { parseUnits } from "@fundable/sdk/core";

const transaction = await fundable.flows.deposit({
  streamId: "42",
  funder: "G...",
  amount: parseUnits("100", 7),
});

const result = await transaction.signAndSend();
```

Router-based NFT creation, Stream NFT reads, and sponsored Paymaster execution
are available when their contract IDs are supplied in the client configuration.
See [Router, Stream NFT, and Paymaster](./router-paymaster.md) for the complete
surface and [Transactions](transactions.md) for authorization and result
handling.
