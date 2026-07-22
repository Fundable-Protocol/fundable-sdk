# Generated Stellar bindings

The contract source of truth is:

- Repository: `https://github.com/Fundable-Protocol/Fundable-Soroban-Contracts`
- Contract packages: Flow, Lockup, Router, Paymaster, Stream NFT, Distributor

## Flow v0.1.0-alpha.1 provenance

- Contract release: `flow-v0.1.0-alpha.1`
- Contract commit: `ac4cefbd82e5b135585b560bb9a5263e4cbba807`
- Optimized WASM SHA-256: `78681f92b213f569109561d9bffba83b24a27d4a9d0a0b80ab6c61f0f16857aa`
- Stellar CLI: `stellar 27.0.0`
- Contract verification: `cargo test -p flow` (40 tests passed)

The binding was generated from the clean, optimized release artifact with:

```bash
stellar contract build --package flow
stellar contract bindings typescript \
  --wasm target/wasm32v1-none/release/flow.wasm \
  --output-dir /tmp/fundable-binding-work/flow
```

For repeatable SDK regeneration, run:

```bash
pnpm generate:flow -- /absolute/path/to/flow.wasm
```

The regeneration script removes the generator's `window.Buffer` mutation. The
binding already imports `Buffer`, and avoiding that mutation keeps the package
free of unexpected browser-global side effects.

Every future binding release must record:

- contract release tag and commit;
- WASM hash or contract specification hash;
- Stellar CLI version;
- exact binding-generation command.

## Protocol contracts v0.1.0-alpha.2 provenance

- Contract release: `contracts-v0.1.0-alpha.2`
- Contract commit: `9289fd9e42a4fbdb7906ceb7a7391b5e59e7744b`
- Stellar CLI: `stellar 27.0.0`
- Contract verification: `make test` from an empty target directory (94 tests
  passed)

Optimized WASM SHA-256 values:

| Contract | SHA-256 |
| --- | --- |
| Flow | `e565a700b1c60de22d792f8e6191320fc3d5073fdca989ce73aa849c8b98d49e` |
| Router | `22ba92932a85d919e54b59c32479de2feffb2e38f791cd73d7fd281864bff71f` |
| Stream NFT | `69d47d59a77eeeb70a83f6136f410bb3a065ed25058df7d250494d176fbe5d3f` |
| Paymaster | `1aa4ac34cacb9ce917cb9bf0cc490f15378ceb98bc9e7ff1eb80354350c54b5e` |

The bindings were regenerated with:

```bash
pnpm generate:flow -- /absolute/path/to/flow.wasm
pnpm generate:router -- /absolute/path/to/router.wasm
pnpm generate:stream-nft -- /absolute/path/to/stream_nft.wasm
pnpm generate:paymaster -- /absolute/path/to/paymaster.wasm
```

The shared generator removes the generated `window.Buffer` mutation. All four
bindings are compiled into the SDK behind chain-neutral high-level clients.

`0.1.0-alpha.3` adds the high-level Lockup Router mapping without changing the
generated bindings or contract artifacts, so it retains this exact provenance.
