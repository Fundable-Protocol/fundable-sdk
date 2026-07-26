# SDK delivery checklist

The SDK deliverable is complete when the package is published, comprehensive
GitBook documentation is publicly available, and runnable example
implementations have been verified against the published package.

This page is the release source of truth. A checked item must have a repository
artifact, an automated check, or a public URL that proves completion.

## 1. Package readiness

- [x] Public `Fundable-Protocol/fundable-sdk` repository exists.
- [x] `@fundable/sdk` is published to npm as a public prerelease.
- [x] Stellar Flow, Router, Stream NFT, and Paymaster clients are exported.
- [x] Shared domain types preserve the future EVM adapter boundary.
- [x] `stellar_client` is migrated as the first production consumer.
- [x] Package exports are verified from a clean consumer project.
- [ ] Stable version is selected and the package is published under npm's
      `latest` tag.
- [ ] Git tag and GitHub release match the published stable package version.

## 2. Documentation readiness

- [x] GitBook reads documentation from `docs/` through `.gitbook.yaml`.
- [x] A curated `SUMMARY.md` defines the documentation navigation.
- [x] Installation and configuration cover browser and server applications.
- [x] Flow operations have complete read and write examples.
- [x] Router Flow and Lockup creation are documented.
- [x] Stream NFT reads and transfers are documented.
- [x] Paymaster security boundaries and forwarding are documented.
- [x] Signing, authorization, simulation, and submission are documented.
- [x] Amounts, timestamps, networks, errors, and public API are documented.
- [x] Transaction tracking and backend indexing responsibilities are
      documented.
- [x] Versioning, generated-binding provenance, and troubleshooting are
      documented.
- [x] All internal documentation links pass an automated check.
- [x] The GitBook space is connected to this repository and its public URL is
      added to `package.json` and the repository README.

## 3. Example readiness

- [x] Examples use `@fundable/sdk` exactly as an external application does.
- [x] Shared environment configuration validates all required values.
- [x] Read a Flow stream and format its token amounts.
- [x] Create a Flow through the Router.
- [x] Create a Lockup through the Router.
- [x] Withdraw from an NFT-backed stream.
- [x] Read Stream NFT ownership and stream metadata.
- [x] Check an allowed Paymaster fee token.
- [x] Demonstrate wallet-controlled signing and submission without embedding
      a secret key.
- [x] Example source files pass TypeScript checking in CI.

## 4. Release acceptance

- [x] Unit tests, type checking, build, documentation checks, and example
      checks pass in CI.
- [x] The packed tarball contains only the intended runtime, type, README, and
      documentation files.
- [x] A clean project can install the packed SDK and compile a representative
      consumer.
- [x] A testnet smoke test verifies documented read and simulation workflows.
- [x] GitBook pages render correctly on desktop.
- [ ] GitBook pages render correctly on mobile.
- [ ] The stable npm package, GitBook URL, examples, source tag, and contract
      provenance all cross-link to one another.

## Delivery gate

Do not call the SDK deliverable complete until every release-acceptance item is
checked. Publishing a prerelease proves the npm pipeline, but it does not
replace stable-package, documentation, and clean-consumer acceptance.
