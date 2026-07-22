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

The Flow binding is compiled into the SDK. Other generated directories
are retained as implementation inputs for upcoming adapters but are excluded
from the published package until their high-level clients are ready.
