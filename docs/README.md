# Fundable SDK

`@fundable/sdk` is the TypeScript integration layer for Fundable Protocol.
It gives applications a typed, high-level API for token streams while keeping
chain-specific transaction handling inside adapters.

Stellar is the first production adapter. The shared model is intentionally
chain-neutral so an EVM adapter can be added without redesigning application
code.

## What you can build

- create and manage continuous Flow streams;
- create NFT-backed Flow and Lockup streams through the Router;
- read and transfer Stream NFTs;
- prepare bounded Paymaster forwarding transactions;
- use exact `bigint` token amounts across browser and server applications.

## Start here

1. Follow [Getting started](getting-started.md) to install and configure the
   SDK.
2. Review [configuration](configuration.md) and
   [transaction signing](transactions.md) before enabling writes.
3. Run the [example implementations](examples.md) against your deployment.
4. Read [Multichain architecture](multichain-architecture.md) to understand
   the stable core and chain-adapter boundary.
5. Use [Router, Stream NFT, and Paymaster](router-paymaster.md) for the
   protocol composition contracts.
6. Review [Generated bindings](generated-bindings.md) when validating contract
   and SDK release provenance.

Review the [release process](releasing.md) for version compatibility and the
[delivery checklist](delivery-checklist.md) for release acceptance evidence.
