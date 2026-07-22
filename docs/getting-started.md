# Getting started

## Installation

```bash
pnpm add @fundable/sdk @stellar/stellar-sdk
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

Read calls return decoded values:

```ts
const stream = await fundable.flows.getStream("42");
const withdrawable = await fundable.flows.getWithdrawableAmount("42");
```

Write calls return a Stellar `AssembledTransaction`, allowing the application
to choose its wallet and authorization workflow:

```ts
import { parseUnits } from "@fundable/sdk/core";

const transaction = await fundable.flows.deposit({
  streamId: "42",
  funder: "G...",
  amount: parseUnits("100", 7),
});

const result = await transaction.signAndSend();
```

Router-based NFT creation and sponsored Paymaster execution are not yet part
of the public SDK workflow. They remain release-roadmap items.
