# Transactions, authorization, and submission

Write methods return Stellar SDK `AssembledTransaction<T>` objects. The
Fundable SDK validates inputs, constructs the contract invocation, and runs
simulation. Your application still controls authorization, signing, and
submission.

## Wallet-controlled submission

Configure the client with the connected wallet's `publicKey`,
`signTransaction`, and `signAuthEntry` callbacks. The resulting transaction can
then complete its required authorization and submit:

```ts
const transaction = await fundable.router.createFlow({
  sender: connectedAccount,
  recipient,
  token: { address: tokenContract, decimals: 7 },
  ratePerSecond: 10_000n,
});

if (
  transaction
    .needsNonInvokerSigningBy()
    .includes(connectedAccount)
) {
  await transaction.signAuthEntries({ address: connectedAccount });
}
const sent = await transaction.signAndSend();

console.log(sent.sendTransactionResponse?.hash);
console.log(sent.result);
```

Some invocations have no additional Soroban authorization entries. Calling
`signAuthEntries` is only required when `transaction.needsNonInvokerSigningBy`
identifies non-invoker addresses that must authorize the call. Each address
must sign through the wallet that controls it; one participant must not attempt
to sign for another.

## Inspect before signing

Applications should show the user the action, token, amount, destination, and
network before invoking a wallet:

```ts
console.log(transaction.toXDR());
console.log(transaction.simulationData);
console.log(transaction.needsNonInvokerSigningBy());
```

Simulation can become stale as ledger state changes. Submit promptly and
handle a failed or expired transaction by rebuilding it rather than silently
changing the signed operation.

## Multi-party workflows

`transaction.toJSON()` serializes the assembled transaction and simulation
data for a controlled multi-party authorization flow. Treat that JSON as an
unsigned transaction proposal:

- authenticate every participant;
- display and verify the invocation before signing;
- bind authorization to the expected network and expiration ledger;
- do not accept mutated serialized transactions from an untrusted party;
- record the final transaction hash only after submission.

## Server signing

A backend may supply signing callbacks when it legitimately owns the source
account or acts as a relayer. Keep the seed in a secrets manager, scope the
account to the smallest necessary authority, enforce policy before signing,
and never expose a generic signing endpoint.

## Result handling

The resolved `result` is the decoded contract return value. The transaction
hash in `sendTransactionResponse.hash` is the durable identifier to store for
reconciliation. A frontend success toast is not a substitute for backend
confirmation and event indexing.
