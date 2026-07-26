# Flow streams

The Flow client talks directly to the continuous-stream engine. Router-created
Flow streams are represented by Stream NFTs; direct Flow engine writes are
available for integrations that deliberately do not use that NFT composition.

All identifiers accept `string | bigint`, all on-chain amounts use `bigint`,
and timestamps are Unix seconds represented by `bigint` or JavaScript `Date`.

## Read a stream

```ts
import { formatUnits } from "@fundable/sdk/core";

const stream = await fundable.flows.getStream("42");
const withdrawable = await fundable.flows.getWithdrawableAmount("42");

console.log({
  sender: stream.sender,
  recipient: stream.recipient,
  status: await fundable.flows.getStatus("42"),
  balance: formatUnits(stream.balance, stream.token.decimals),
  withdrawable: formatUnits(withdrawable, stream.token.decimals),
});
```

Other read methods are `getBalance`, `getRatePerSecond`,
`getRefundableAmount`, `getTotalDebt`, `getCoveredDebt`,
`getUncoveredDebt`, and `getDepletionTime`.

## Create and fund

```ts
import { parseUnits } from "@fundable/sdk/core";

const transaction = await fundable.flows.createAndDeposit({
  sender: connectedAccount,
  recipient,
  token: { address: tokenContract, decimals: 7, symbol: "USDC" },
  ratePerSecond: parseUnits("0.001", 7),
  amount: parseUnits("100", 7),
  startTime: new Date(),
});

const sent = await transaction.signAndSend();
console.log(sent.result); // stream ID
```

Use `create` when funding will happen separately and `deposit` to add balance
to an existing stream.

## Manage a stream

```ts
await (
  await fundable.flows.pause({ streamId: "42", actor: connectedAccount })
).signAndSend();

await (
  await fundable.flows.restart({
    streamId: "42",
    actor: connectedAccount,
    ratePerSecond: parseUnits("0.002", 7),
  })
).signAndSend();
```

The management methods are:

| Method | Actor and effect |
| --- | --- |
| `adjustRate` | Sender changes the ongoing rate. |
| `pause` | Sender pauses accrual. |
| `restart` | Sender restarts with a positive rate. |
| `refund` | Sender returns a specified refundable amount. |
| `refundMax` | Sender returns the maximum refundable amount. |
| `withdraw` | Authorized caller sends a specified amount to `to`. |
| `withdrawMax` | Authorized caller sends the maximum amount to `to`. |
| `void` | Authorized caller permanently voids the stream. |

The contract remains the authority for permissions and available amounts. SDK
validation catches malformed inputs before simulation but does not replace
on-chain authorization.

## Router or direct Flow?

Use `fundable.router.createFlow` for Fundable's NFT-backed product workflow.
Use `fundable.flows.create` or `createAndDeposit` only when the application
explicitly needs a direct engine stream. Withdrawal from an NFT-backed stream
uses the Router token ID, not the engine stream ID.
