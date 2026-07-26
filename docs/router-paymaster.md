# Router, Stream NFT, and Paymaster development

These capabilities are available from `0.1.0-alpha.2`. Router Lockup creation
is available from `0.1.0-alpha.3`.

Configure their contract IDs to enable the optional capability groups:

```ts
const fundable = createFundableClient({
  chain: "stellar",
  network: "testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contracts: {
    flow: "C...",
    router: "C...",
    streamNft: "C...",
    paymaster: "C...",
  },
});
```

The initial surface includes:

- `router.createFlow`, `router.createLockup`, `router.withdraw`, and
  `router.withdrawMax`;
- `streamNft.ownerOf`, `streamNft.balanceOf`, `streamNft.getStreamData`, and
  `streamNft.transfer`;
- `paymaster.isFeeTokenAllowed` and bounded `paymaster.forward` calls.

All write methods return Stellar `AssembledTransaction` objects. Applications
retain control over simulation, Soroban authorization, signing, and submission.
See [Transactions and authorization](transactions.md) before enabling writes.

`router.createLockup` accepts chain-neutral schedule values and validates the
time range, optional cliff, unlock amounts, and granularity before simulation:

```ts
const transaction = await fundable.router?.createLockup({
  sender: "G...",
  recipient: "G...",
  token: { address: "C...", decimals: 7 },
  totalAmount: 10_000_000_000n,
  startTime: 1_800_000_000n,
  endTime: 1_802_592_000n,
  cliffTime: 1_800_604_800n,
  granularitySeconds: 3_600n,
  cancelable: true,
});
```

Router withdrawals use the Stream NFT token ID:

```ts
if (!fundable.router) throw new Error("Router is not configured");

const transaction = await fundable.router.withdrawMax({
  tokenId: "7",
  caller: connectedAccount,
  to: connectedAccount,
});
```

Read Stream NFT ownership and the underlying engine stream mapping:

```ts
if (!fundable.streamNft) throw new Error("Stream NFT is not configured");

const owner = await fundable.streamNft.ownerOf("7");
const stream = await fundable.streamNft.getStreamData("7");
```

Check fee-token policy before constructing a Paymaster forward:

```ts
if (!fundable.paymaster) throw new Error("Paymaster is not configured");

const allowed = await fundable.paymaster.isFeeTokenAllowed(feeTokenContract);
```

`paymaster.forward` is a bounded advanced call. The application must verify the
target contract, function name, raw Soroban arguments, fee recipient, maximum
fee, and expiration ledger before asking the user to authorize. Never expose a
backend endpoint that signs arbitrary forwarding input.

## Testnet integration

The integration suite reads Stream NFT and Paymaster state and simulates Router
Flow and Lockup creation against the recorded testnet deployment without
submitting a transaction:

```bash
pnpm test:testnet
```

Set the `FUNDABLE_TESTNET_*` environment variables to test a replacement
deployment. The committed defaults correspond to the contract release recorded
in the generated-binding provenance guide.
