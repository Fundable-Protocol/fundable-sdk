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

## Mainnet-readiness release provenance

- Contract commit: `62dfc41ac8c1fa48d66c5fe5e9c7e98f9e4f9529`
- Stellar CLI: `stellar 27.0.0`

Reproducible WASM SHA-256 values:

| Contract | SHA-256 |
| --- | --- |
| Flow | `6201c10afc509b53bf3a9bb307730ee996accdcc4f17864126bbd8aa576dbee6` |
| Lockup | `500f152a8ffb8126e36af6df149eee5712c9a575b9c1979142de2619fe8920d3` |
| Router | `c1ddde9e7679fd1068523a7994a7fbc1390a0a98526ccfba0a317886f36b6f09` |
| Stream NFT | `0e6440a0a2108b254459988c214bcb225ddd838fabdb7623450a65ccbdeddb63` |

The SDK `0.2.0` bindings were generated from the four reproducible release
artifacts with the corresponding `pnpm generate:* -- /absolute/path.wasm`
commands. The transitional Paymaster was intentionally not regenerated.

## Hardened contract release provenance (SDK v0.2.3)

- Contract verification: `make build` and `cargo test` (98 tests passed)
- Stellar CLI: `stellar 22.0.2`

Optimized WASM SHA-256 values:

| Contract | SHA-256 |
| --- | --- |
| Flow | `3903d1dee59ef048a64d5287bb9e27e05d54c3c8dc3962e28c16b2031d074906` |
| Lockup | `e752e3589144c340136c0fa6a1ab344dd794ad547d3fe0bebcce7c1f995b59fc` |
| Router | `36e881b771aa6f64bb0d96915e61e6d65a0f976bce332b4b73102ac8d228c4c9` |
| Stream NFT | `61ec4bfa817780d65ed439b01dc39d703162c6801346427df7a05d4256f94726` |
| Paymaster | `b068fcfa6103a2686997939d1942629c9f97ce941df85109fd0181f4622e9195` |

The bindings were regenerated with `scripts/generate-stellar-binding.mjs` for all five contracts:
- `pnpm generate:flow -- /path/to/flow.wasm`
- `pnpm generate:lockup -- /path/to/lockup.wasm`
- `pnpm generate:router -- /path/to/router.wasm`
- `pnpm generate:stream-nft -- /path/to/stream_nft.wasm`
- `pnpm generate:paymaster -- /path/to/paymaster.wasm`

Key contract changes reflected in SDK v0.2.3:
- Contract initialization (`initialize`) methods require explicit `admin` authorization.
- Two-step administrative transfers: `propose_admin` followed by `accept_admin`.
- Timelocked contract upgrades: `propose_upgrade` followed by `execute_upgrade` (or direct `upgrade` for immediate upgrades).
- Stream TTL extension: `extend_stream_ttl`.
- Router delegates NFT ownership and stream indexing to the Stream NFT contract; `create_flow_stream` and `create_lockup_stream` cleanly handle routing without redundant caller parameters.
- Comprehensive contract error coverage mapped: Flow 1–28, Lockup 101–120, Stream NFT 201–205, Router 301–305, Paymaster 401–408.

