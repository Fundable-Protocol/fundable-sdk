# Fundable SDK examples

These scripts import `@fundable/sdk` through the same package export used by an
external application. They default to Stellar testnet, simulate write
transactions, and never submit a transaction or load a secret key.

## Configure

Copy the example values into your shell or environment manager:

```bash
export FUNDABLE_RPC_URL="https://soroban-testnet.stellar.org"
export FUNDABLE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export FUNDABLE_FLOW_CONTRACT="C..."
export FUNDABLE_ROUTER_CONTRACT="C..."
export FUNDABLE_STREAM_NFT_CONTRACT="C..."
export FUNDABLE_PAYMASTER_CONTRACT="C..."
export FUNDABLE_DISTRIBUTOR_CONTRACT="C..."
export FUNDABLE_PUBLIC_KEY="G..."
export FUNDABLE_RECIPIENT="G..."
export FUNDABLE_TOKEN_CONTRACT="C..."
```

Only the values needed by a selected example are required. Read examples do
not require `FUNDABLE_PUBLIC_KEY` unless the RPC operation needs a source
account.

## Run

From the repository:

```bash
pnpm example:read-flow
pnpm example:create-router-flow
pnpm example:create-router-lockup
pnpm example:withdraw-router
pnpm example:read-stream-nft
pnpm example:check-paymaster
pnpm example:create-distribution
pnpm example:claim-distribution
```

The package is built before each command so Node resolves `@fundable/sdk`
through the published export map.

## Signing

[`wallet-sign-and-submit.ts`](wallet-sign-and-submit.ts) shows how an
application submits a Router Flow after constructing the client with wallet
callbacks. It intentionally has no secret-key implementation. Browser and
mobile applications should delegate both transaction-envelope and Soroban
authorization signing to their connected wallet.

Write scripts in this folder stop after successful simulation and print the
assembled XDR plus any non-invoker addresses that need authorization. Review
the transaction before sending it to a wallet.
