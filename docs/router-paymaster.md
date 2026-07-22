# Router, Stream NFT, and Paymaster development

These capabilities are implemented on the `feat/router-nft-paymaster`
development branch and are not part of `0.1.0-alpha.1`.

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

## Release gates

Before publishing these capabilities, regenerate all three bindings from clean,
tagged contract artifacts and record their commit, WASM hash, Stellar CLI
version, and exact generation commands. Add integration coverage against a
deployed testnet set before promoting the next prerelease.
