# Multichain architecture

Fundable's public domain model is independent of any individual blockchain.
Chain adapters translate that model into native contract calls and transaction
lifecycles.

```text
Application
    |
Fundable domain types and capability interfaces
    |---------------------------|
Stellar adapter             Future EVM adapter
    |                           |
Soroban bindings            Solidity ABI client
```

## Shared layer

The shared layer owns:

- flow and distribution inputs;
- normalized records and statuses;
- `bigint` amount representation;
- stable Fundable error codes;
- capability interfaces.

It must not expose `ScVal`, Soroban integer aliases, EVM calldata, or a
wallet-specific signer.

## Chain adapters

Each adapter owns:

- address and network validation;
- native contract bindings;
- simulation and gas/resource preparation;
- transaction serialization and signing integration;
- native error translation.

Adapters may expose native transaction handles for advanced use cases. Common
capability names do not require Stellar and EVM transaction internals to be
identical.

## Adding EVM later

An EVM adapter should implement the shared capability inputs and normalized
records, then own EVM-specific addresses, chain IDs, ABI encoding, simulation,
gas estimation, wallet clients, transaction receipts, and error mapping.
Applications can continue using shared token, schedule, stream, and amount
types while narrowing to an adapter-native transaction handle when they need
chain-specific behavior.

Do not force Stellar authorization concepts into the EVM adapter or reduce
both chains to an untyped transaction abstraction. The stable boundary is the
Fundable operation and result model, not identical wallet internals.
