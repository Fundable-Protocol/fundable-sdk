# Configuration

Create one client for each Stellar network and contract deployment your
application uses.

```ts
import { createFundableClient } from "@fundable/sdk";

const fundable = createFundableClient({
  chain: "stellar",
  network: "testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contracts: {
    flow: process.env.FUNDABLE_FLOW_CONTRACT!,
    router: process.env.FUNDABLE_ROUTER_CONTRACT,
    streamNft: process.env.FUNDABLE_STREAM_NFT_CONTRACT,
  },
  sponsorship: { backendUrl: process.env.FUNDABLE_BACKEND_URL! },
  publicKey: connectedAccount,
  signTransaction: wallet.signTransaction,
  signAuthEntry: wallet.signAuthEntry,
});
```

## Required values

| Field | Purpose |
| --- | --- |
| `chain` | Must be `"stellar"` in the current release. |
| `network` | `"public"`, `"testnet"`, or `"custom"`. |
| `rpcUrl` | Soroban JSON-RPC endpoint used for reads and simulation. |
| `networkPassphrase` | Passphrase of the network served by `rpcUrl`. |
| `contracts.flow` | Deployed Flow engine contract ID. |

The SDK does not infer a passphrase or contract deployment from the network
label. Keep all three values in the same environment configuration to prevent
cross-network signing errors.

## Optional capabilities

`router`, `streamNft`, and `sponsorship` are only present on the client when
their corresponding contract ID or backend URL is configured:

```ts
if (!fundable.router) {
  throw new Error("Router is not configured for this deployment");
}
```

This makes a missing deployment explicit instead of sending a transaction to
an invented or stale address.

The custom `paymaster` contract option is deprecated and must not be used for
production sponsorship. Configure `sponsorship.backendUrl` to use the
backend-validated OpenZeppelin FeeForwarder flow.

## Signing callbacks

`publicKey`, `signTransaction`, and `signAuthEntry` are optional for read-only
clients. Supply them for write workflows. The callback shapes come from
`@stellar/stellar-sdk/contract` and can be backed by a browser wallet, a mobile
wallet bridge, or a controlled server signer.

Never put a secret seed in browser source, environment variables exposed to a
frontend build, documentation examples, or SDK configuration committed to
Git.

## Server and local RPC

HTTPS is required by default. Set `allowHttp: true` only for a trusted local
development RPC endpoint. Custom request headers can be supplied with
`headers`, for example when an RPC provider requires an API key. Keep those
headers server-side when they contain credentials.

## Contract deployment registry

Production applications should maintain a reviewed registry keyed by network,
release, and chain:

```ts
const deployments = {
  stellar: {
    testnet: {
      release: "contracts-v0.1.0-alpha.2",
      flow: "C...",
      router: "C...",
      streamNft: "C...",
      paymaster: "C...",
    },
  },
} as const;
```

Do not accept contract IDs directly from an untrusted URL or user input. A
malicious replacement address would cause the SDK to simulate and sign calls
to a different contract.
