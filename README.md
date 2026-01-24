# @fundable/sdk

TypeScript SDK for interacting with the Fundable Protocol's smart contracts on the Stellar network.

**Note:** This SDK is currently under development. The API is not yet stable and may change.

## Installation

Once published, you can install the SDK using your package manager of choice:

```bash
pnpm add @fundable/sdk
# or
npm install @fundable/sdk
# or
yarn add @fundable/sdk
```

## Peer Dependencies

This SDK has a peer dependency on `@stellar/stellar-sdk`. You will need to have it installed in your project:

```bash
pnpm add @stellar/stellar-sdk
```

---

## API Reference (Under Development)

The SDK will provide client classes for interacting with the deployed smart contracts.

### `PaymentStreamClient` (Planned)

The `PaymentStreamClient` will provide methods for interacting with the `payment-stream` contract.

-   **`createStream(...)`**: Create a new payment stream.
-   **`getStream(...)`**: Retrieve stream details.
-   **`withdrawableAmount(...)`**: Calculate the withdrawable amount for a stream.
-   **`withdraw(...)`**: Withdraw from a stream.
-   **`pauseStream(...)`**: Pause a stream.
-   **`resumeStream(...)`**: Resume a stream.
-   **`cancelStream(...)`**: Cancel a stream.

### `DistributorClient` (Planned)

The `DistributorClient` will provide methods for interacting with the `distributor` contract.

-   **`distributeEqual(...)`**: Distribute tokens equally to a list of recipients.
-   **`distributeWeighted(...)`**: Distribute tokens with weighted amounts to a list of recipients.

### Data Structures

#### `Stream`

The `Stream` interface represents the data structure for a payment stream.

```typescript
export interface Stream {
    id: bigint;
    sender: string;
    recipient: string;
    token: string;
    totalAmount: bigint;
    withdrawnAmount: bigint;
    startTime: bigint;
    endTime: bigint;
    status: "Active" | "Paused" | "Canceled" | "Completed";
}
```

## Usage Example (Planned)

A usage example will be provided once the client classes are implemented.

```typescript
// Example of how the SDK might be used in the future

import { PaymentStreamClient } from "@fundable/sdk";
import { SorobanRpc } from "@stellar/stellar-sdk";

const client = new PaymentStreamClient({
    rpc: new SorobanRpc.Server("https://soroban-testnet.stellar.org"),
    contractId: "YOUR_CONTRACT_ID",
});

async function main() {
    const stream = await client.getStream(1);
    console.log(stream);
}

main();
```
