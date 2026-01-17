/**
 * Fundable Stellar SDK
 * 
 * TypeScript SDK for interacting with Fundable Protocol smart contracts on Stellar.
 */

// Placeholder exports - to be implemented
export const VERSION = "0.1.0";

// Contract types will be generated from Soroban contract bindings
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

// TODO: Add contract client wrappers
// export class PaymentStreamClient { }
// export class DistributorClient { }
