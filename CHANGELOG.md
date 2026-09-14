# Changelog

All notable changes to `@fundable/sdk` are documented here.

## 0.2.3

Hardened Soroban contract alignment release.

### Added

- Administrative and maintenance clients on `client.admin` (`StellarAdminClient`, `FlowAdminClient`, `LockupAdminClient`, `RouterAdminClient`) exposing:
  - `proposeUpgrade`, `executeUpgrade`, and direct `upgrade`
  - Two-step admin transfers: `proposeAdmin`, `acceptAdmin`
  - Stream TTL extension: `extendStreamTtl`
  - Router NFT upgrades: `upgradeNft`
- Comprehensive Soroban error mappings covering Flow 1–28 (e.g. `TokenTransferMismatch`, `TokenDecimalsMismatch`, `ArithmeticError`), Lockup 101–120 (including corrected 111 `NegativeUnlockAmount`, `StartUnlockAmountExceedsTotal`, `GranularityZero`), Stream NFT 201–205, Router 301–305 (`InvalidContractAddress`), Paymaster 401–408.
- Client-side validations for Lockup unlock amounts (`assertLockupUnlockAmounts`) and token decimals (`assertTokenDecimalsMatch`).
- Stream NFT delegated queries for Router stream metadata and status.

### Changed

- Regenerated TypeScript contract bindings for Flow, Lockup, Router, Stream NFT, and Paymaster from hardened contract WASM builds.
- Router `createFlow` and `createLockup` aligned with hardened contract interface, delegating stream token minting and indexing to the Stream NFT contract.
- Re-exported error parsing and Soroban error definitions (`SOROBAN_CONTRACT_ERRORS`, `parseSorobanErrorCode`, `translateSorobanError`, `toStellarFundableError`).

## 0.2.1

### Fixed

- parse the Fundable backend's `{ status, data }` success envelope across wallet
  authentication and sponsorship requests;
- call the browser's native `fetch` with its required global receiver.

## 0.2.0

Mainnet-readiness integration release.

### Added

- authenticated Stellar wallet sessions for the Fundable backend;
- typed sponsorship quote, build, authorization signing, and idempotent submit;
- explicit sponsorship fee and authorization-expiration fields;
- canonical Router stream metadata, status, owner, and core-ID reads;
- first-class Lockup cancellation, status, and amount reads;
- immutable Stream NFT transferability reads;
- Router Flow initial funding and per-stream transferability inputs.

### Changed

- regenerated Flow, Lockup, Router, and Stream NFT bindings from the verified
  mainnet-readiness release artifacts;
- distinguished confirmed Stream NFT token IDs from transaction hashes in
  sponsorship results;
- marked the custom Fundable Paymaster client as deprecated and migration-only.

## 0.1.0

First stable Fundable SDK release.

### Added

- chain-neutral Flow, Lockup, token, amount, status, and error types;
- Stellar Flow client reads and lifecycle transactions;
- Stellar Router Flow and Lockup creation plus NFT-backed withdrawals;
- Stream NFT ownership, metadata, balance, and transfer operations;
- Paymaster fee-token checks and bounded forwarding transactions;
- generated Soroban bindings with recorded contract provenance;
- exact `bigint` unit conversion helpers;
- runnable Stellar examples and clean-consumer package verification;
- public GitBook documentation and backend-indexing guidance.

### Compatibility

- Node.js 20 or newer;
- `@stellar/stellar-sdk` 14.4.3 or compatible 14.x release;
- Fundable Soroban contract release `contracts-v0.1.0-alpha.2`;
- generated binding provenance recorded in
  `docs/generated-bindings.md`.

### Known limitations

- Stellar is the only implemented chain adapter;
- EVM is represented in the shared architecture but is not implemented;
- the Paymaster forwarding API expects reviewed raw Soroban arguments;
- backend transaction completeness requires chain event indexing and cannot
  rely on SDK telemetry.
