# Generated Stellar bindings

The initial generated bindings were extracted from the historical
`stellar_client/packages/sdk` package. The contract source of truth is:

- Repository: `https://github.com/Fundable-Protocol/Fundable-Soroban-Contracts`
- Contract packages: Flow, Lockup, Router, Paymaster, Stream NFT, Distributor

Before the first public prerelease, regenerate every binding from a clean,
tagged contract release and record:

- contract release tag and commit;
- WASM hash or contract specification hash;
- Stellar CLI version;
- exact binding-generation command.

The current Flow binding is compiled into the SDK. Other generated directories
are retained as implementation inputs for upcoming adapters but are excluded
from the published package until their high-level clients are ready.
