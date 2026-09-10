# Sponsored transactions

Production sponsorship uses Fundable's authenticated backend and the native
OpenZeppelin FeeForwarder flow. The browser prepares the intended Router or
engine call; the backend chooses and validates the fee token, relayer, target,
function, arguments, fee bounds, and authorization tree.

```ts
await fundable.sponsorship!.authenticate(
  connectedAccount,
  "TESTNET",
  wallet.signMessage,
);

const unsignedXdr = transaction.toXDR();
const quote = await fundable.sponsorship!.quote(unsignedXdr, "TESTNET");
// Display quote.feeToken, estimatedFeeUi, maximumFeeUi, and the action.

let build = await fundable.sponsorship!.build(unsignedXdr, "TESTNET");
if (fundable.sponsorship!.isBuildExpired(build)) {
  build = await fundable.sponsorship!.build(unsignedXdr, "TESTNET");
}

const signedAuthEntry =
  await fundable.signSponsorshipAuthorization(build);
const result = await fundable.sponsorship!.submit({
  build,
  signedAuthEntry,
  network: "TESTNET",
  intent,
  idempotencyKey: crypto.randomUUID(),
});
```

Use `result.streamTokenId` as the public stream identifier only after it is
present in a confirmed backend result. `result.transactionHash` identifies the
submission and must never be substituted for a stream ID. If authorization
expires, rebuild and show the updated fee before asking the wallet to sign.
