# Example implementations

The repository includes runnable TypeScript examples that import the public
package boundary:

| Example | Purpose |
| --- | --- |
| `read-flow.ts` | Read normalized Flow state and format exact amounts. |
| `create-router-flow.ts` | Simulate NFT-backed Flow creation. |
| `create-router-lockup.ts` | Simulate an NFT-backed Lockup schedule. |
| `withdraw-router.ts` | Simulate a Router withdrawal by Stream NFT token ID. |
| `read-stream-nft.ts` | Read ownership and underlying stream metadata. |
| `check-paymaster.ts` | Read the Paymaster fee-token allowlist. |
| `wallet-sign-and-submit.ts` | Integrate wallet callbacks without a secret key. |

See the repository's [examples README](../examples/README.md) for environment
variables and commands. Write examples simulate and print XDR but do not
submit. This makes them safe to run while still verifying contract addresses,
inputs, source accounts, RPC connectivity, and transaction assembly.

Run the static acceptance check with:

```bash
pnpm examples:typecheck
```
