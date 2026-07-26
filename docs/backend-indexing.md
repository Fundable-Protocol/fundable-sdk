# Backend indexing and transaction tracking

The SDK does not report user activity to Fundable's backend. That is deliberate:
a public integration library should not require a central API call for an
on-chain transaction to work, and clients can bypass the library and call the
contracts directly.

To track every interaction with Fundable contracts, index the chain rather
than relying on SDK callbacks.

## Recommended architecture

```text
Application using SDK ──signs and submits──> Fundable contracts
                                                │
                                                │ contract events and ledger data
                                                ▼
                                      Fundable chain indexer
                                                │
                                                ▼
                                      normalized backend database
```

The production client and third-party applications may submit transaction
hashes to an ingestion endpoint for faster user feedback, but that endpoint is
only a hint. The indexer remains the source of completeness.

## Indexer responsibilities

1. Maintain the approved contract deployment registry for each network.
2. Ingest ledgers and events for Flow, Lockup, Router, Stream NFT, Paymaster,
   and Distributor contracts.
3. Decode events using the contract release that was active for that address.
4. Upsert normalized streams, ownership, deposits, withdrawals, cancellations,
   and sponsored calls using an idempotent event key.
5. Record transaction hash, ledger sequence, event position, network, contract
   ID, and contract release as provenance.
6. Advance a durable checkpoint only after all events in a ledger are stored.
7. Reconcile submitted transaction hints against indexed on-chain results.
8. Alert on decode failures, checkpoint lag, and unknown contract addresses.

An idempotency key should include at least network, ledger sequence,
transaction position, and event position. Never identify an event only by a
stream ID, because multiple operations can affect the same stream.

## SDK responsibility

The SDK should:

- return the native assembled transaction and decoded result;
- expose the final transaction hash after submission;
- keep public input and output types stable across adapters;
- avoid hidden telemetry or a hard dependency on Fundable's backend.

An optional future convenience method may notify a Fundable API after
submission, but it cannot provide complete accounting. Direct contract calls,
failed notifications, and alternative SDKs would otherwise create gaps.

## Database boundary

Store chain facts separately from application metadata. On-chain amounts and
IDs should be losslessly stored as integer strings or database numeric types,
not JavaScript floating-point numbers. Associate off-chain users or projects
through a separate mapping so re-indexing chain state does not overwrite
product-specific data.
