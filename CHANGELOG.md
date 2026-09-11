# Changelog

All notable changes to `@fundable/sdk` are documented here.

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
