# Router, Stream NFT, and Paymaster development

These capabilities are available from `0.1.0-alpha.2`.

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

- `router.createFlow`, `router.withdraw`, and `router.withdrawMax`;
- `streamNft.ownerOf`, `streamNft.balanceOf`, `streamNft.getStreamData`, and
  `streamNft.transfer`;
- `paymaster.isFeeTokenAllowed` and bounded `paymaster.forward` calls.

All write methods return Stellar `AssembledTransaction` objects. Applications
retain control over simulation, Soroban authorization, signing, and submission.

## Testnet integration

The integration suite reads Stream NFT and Paymaster state and simulates Router
flow creation against the recorded testnet deployment without submitting a
transaction:

```bash
pnpm test:testnet
```

Set the `FUNDABLE_TESTNET_*` environment variables to test a replacement
deployment. The committed defaults correspond to the contract release recorded
in the generated-binding provenance guide.
