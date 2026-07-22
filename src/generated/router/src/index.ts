import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

/**
 * Core data structure for a Flow (open-ended, rate-per-second) stream.
 * 
 * Ported from Sablier's `Flow.Stream` struct with these adaptations:
 * 
 * - `UD21x18 ratePerSecond` → `i128 rate_per_second` scaled to 18 decimals.
 * Soroban has no native fixed-point type, so we use i128 with manual scaling.
 * A rate of 1 token/sec for a 7-decimal token = 1e18 internally.
 * 
 * - `IERC20 token` → `Address` (Soroban token contract address).
 * 
 * - `uint128 balance` → `i128` (Soroban SDK convention for token amounts).
 * 
 * - `uint40 snapshotTime` → `u64` (Soroban ledger timestamp is u64).
 * 
 * - `bool isStream` sentinel removed — we use storage key existence instead.
 * 
 * - `bool isTransferable` removed — delegated to the NFT contract layer.
 * 
 * # Storage Layout
 * 
 * Each stream is stored under `DataKey::Stream(stream_id)` in persistent storage.
 * The struct is kept as flat as possible to minimize serialization overhead.
 */
export interface FlowStream {
  /**
 * Current balance held in the stream (deposited - withdrawn), in token decimals.
 */
balance: i128;
  /**
 * Whether the stream has been permanently voided.
 */
is_voided: boolean;
  /**
 * Rate at which debt accrues, in 18-decimal fixed-point.
 * 0 means the stream is paused.
 * Example: 1 token/sec for a 7-decimal token → 1_000_000_000_000_000_000 (1e18).
 */
rate_per_second: i128;
  /**
 * The address receiving the tokens (can withdraw).
 */
recipient: string;
  /**
 * The address streaming the tokens (can pause, adjust, refund).
 */
sender: string;
  /**
 * Accumulated debt at the last snapshot, in 18-decimal fixed-point.
 * Total debt = snapshot_debt_scaled + ongoing_debt_scaled.
 */
snapshot_debt_scaled: i128;
  /**
 * Unix timestamp of the last debt snapshot.
 * Debt accrues from this point forward at `rate_per_second`.
 */
snapshot_time: u64;
  /**
 * The Soroban token contract address (SAC or custom SEP-41).
 */
token: string;
  /**
 * Number of decimals for the token (e.g. 7 for most Stellar assets).
 * Used for scale/descale operations. Max 18.
 */
token_decimals: u32;
}

/**
 * Type of stream (Flow or Lockup).
 * Used by the Stream NFT and Router to route logic to the correct engine.
 */
export enum StreamType {
  Flow = 0,
  Lockup = 1,
}

/**
 * Status of a Lockup stream.
 * 
 * Uses "temperature" semantics:
 * - **Warm** (Pending, Streaming): time alone can change the status.
 * - **Cold** (Settled, Canceled, Depleted): time alone cannot change the status.
 */
export enum LockupStatus {
  Pending = 0,
  Streaming = 1,
  Settled = 2,
  Canceled = 3,
  Depleted = 4,
}


/**
 * Core data structure for a Lockup (fixed-term vesting) stream.
 * 
 * Supports linear unlock with optional cliff. The vested ("streamed") amount
 * at any time `t` is calculated as:
 * 
 * ```text
 * if t < start_time:       vested = 0
 * if t < cliff_time:       vested = start_unlock_amount
 * if t >= end_time:         vested = total_amount
 * else:
 * elapsed = floor((t - cliff_time) / granularity) * granularity
 * streamable_duration = end_time - cliff_time
 * streamable_amount = total_amount - start_unlock_amount - cliff_unlock_amount
 * vested = start_unlock_amount + cliff_unlock_amount + (elapsed * streamable_amount / streamable_duration)
 * ```
 * 
 * This mirrors the reference linear lockup calculation with discrete unlock
 * steps at `granularity`-second intervals.
 */
export interface LockupStream {
  /**
 * Whether the sender can cancel this stream and reclaim unvested tokens.
 */
cancelable: boolean;
  /**
 * Optional cliff timestamp. No tokens beyond `start_unlock_amount`
 * vest before this time. Set to 0 for no cliff.
 */
cliff_time: u64;
  /**
 * Amount unlocked at `cliff_time` (in addition to `start_unlock_amount`).
 */
cliff_unlock_amount: i128;
  /**
 * Unix timestamp when the lockup is fully unlocked.
 */
end_time: u64;
  /**
 * Unlock granularity in seconds. Tokens vest in discrete steps of this
 * interval. Default = 1 (per-second vesting). Must be > 0.
 */
granularity: u64;
  /**
 * Whether all tokens have been withdrawn and/or refunded.
 */
is_depleted: boolean;
  /**
 * The address that receives tokens as they unlock (can withdraw).
 */
recipient: string;
  /**
 * Amount refunded to sender on cancellation. Zero unless cancelled.
 */
refunded_amount: i128;
  /**
 * The address that created and funded the lockup (can cancel if `cancelable`).
 */
sender: string;
  /**
 * Unix timestamp when the lockup begins.
 */
start_time: u64;
  /**
 * Amount unlocked immediately at `start_time`.
 */
start_unlock_amount: i128;
  /**
 * The Soroban token contract address.
 */
token: string;
  /**
 * Total amount deposited into the stream (in token decimals).
 */
total_amount: i128;
  /**
 * Whether the stream has been cancelled.
 */
was_canceled: boolean;
  /**
 * Cumulative amount withdrawn by the recipient.
 */
withdrawn_amount: i128;
}

/**
 * Status of a Flow stream.
 * 
 * The status is derived from the stream's current state (rate, balance, debt, voided flag) rather than
 * being stored directly — keeping storage minimal.
 */
export enum StreamStatus {
  Pending = 0,
  StreamingSolvent = 1,
  StreamingInsolvent = 2,
  PausedSolvent = 3,
  PausedInsolvent = 4,
  Voided = 5,
}


/**
 * Parameters for creating a new Lockup stream.
 * 
 * Bundled into a struct because Soroban contract functions
 * have a max of 10 parameters.
 */
export interface CreateLockupParams {
  /**
 * Whether the sender can cancel the stream.
 */
cancelable: boolean;
  /**
 * Optional cliff timestamp. Set to 0 for no cliff.
 */
cliff_time: u64;
  /**
 * Tokens unlocked at cliff (added to start).
 */
cliff_unlock_amount: i128;
  /**
 * Unix timestamp when vesting completes.
 */
end_time: u64;
  /**
 * Unlock step interval in seconds. 0 defaults to 1.
 */
granularity: u64;
  /**
 * Address receiving vested tokens.
 */
recipient: string;
  /**
 * Address funding the stream (can cancel if `cancelable`).
 */
sender: string;
  /**
 * Unix timestamp when vesting begins.
 */
start_time: u64;
  /**
 * Tokens unlocked immediately at start.
 */
start_unlock_amount: i128;
  /**
 * Soroban token contract address.
 */
token: string;
  /**
 * Total tokens to vest (in token decimals).
 */
total_amount: i128;
}

/**
 * Errors specific to the Stream NFT contract.
 */
export const NftError = {
  201: {message:"AlreadyInitialized"},
  202: {message:"NotAuthorized"},
  203: {message:"TokenNotFound"},
  204: {message:"NotTransferable"},
  /**
   * Token ID has already been minted.
   */
  205: {message:"AlreadyMinted"}
}

/**
 * Errors emitted by the Flow streaming contract.
 */
export const FlowError = {
  /**
   * Stream ID does not exist.
   */
  1: {message:"StreamNotFound"},
  /**
   * Caller is not authorized for this operation.
   */
  2: {message:"Unauthorized"},
  /**
   * Stream is paused; operation requires active streaming.
   */
  3: {message:"StreamPaused"},
  /**
   * Stream is voided; no further mutations allowed.
   */
  4: {message:"StreamVoided"},
  /**
   * Stream is not paused; restart requires a paused stream.
   */
  5: {message:"StreamNotPaused"},
  /**
   * Stream has not started yet (snapshot_time in the future).
   */
  6: {message:"StreamPending"},
  /**
   * New rate per second must be > 0.
   */
  7: {message:"RatePerSecondZero"},
  /**
   * New rate must differ from current rate.
   */
  8: {message:"RateNotDifferent"},
  /**
   * Deposit amount must be > 0.
   */
  9: {message:"DepositAmountZero"},
  /**
   * Withdraw amount must be > 0.
   */
  10: {message:"WithdrawAmountZero"},
  /**
   * Withdraw amount exceeds withdrawable balance.
   */
  11: {message:"Overdraw"},
  /**
   * Refund amount must be > 0.
   */
  12: {message:"RefundAmountZero"},
  /**
   * Refund amount exceeds refundable balance.
   */
  13: {message:"RefundOverflow"},
  /**
   * Token has > 18 decimals, unsupported.
   */
  14: {message:"InvalidTokenDecimals"},
  /**
   * Stream balance is zero (e.g. querying depletion time).
   */
  15: {message:"BalanceZero"},
  /**
   * Contract already initialized.
   */
  16: {message:"AlreadyInitialized"},
  /**
   * Contract not yet initialized.
   */
  17: {message:"NotInitialized"},
  /**
   * Cannot create a pending stream with rate_per_second = 0.
   */
  18: {message:"CreateRatePerSecondZero"},
  /**
   * Internal math error — should never occur in production.
   */
  19: {message:"InvalidCalculation"},
  /**
   * Sender and recipient must be different addresses.
   */
  20: {message:"SenderEqualsRecipient"},
  /**
   * Rate per second must not be negative.
   */
  21: {message:"NegativeRate"}
}

/**
 * Errors emitted by the Lockup vesting contract.
 */
export const LockupError = {
  /**
   * Stream ID does not exist.
   */
  101: {message:"StreamNotFound"},
  /**
   * Caller is not authorized.
   */
  102: {message:"Unauthorized"},
  /**
   * Stream is already cancelled.
   */
  103: {message:"AlreadyCancelled"},
  /**
   * Stream is not cancelable.
   */
  104: {message:"NotCancelable"},
  /**
   * Withdraw amount exceeds unlocked balance.
   */
  105: {message:"Overdraw"},
  /**
   * Invalid time parameters (start >= end, cliff outside range).
   */
  106: {message:"InvalidTimeRange"},
  /**
   * Total amount must be > 0.
   */
  107: {message:"AmountZero"},
  /**
   * Contract already initialized.
   */
  108: {message:"AlreadyInitialized"},
  /**
   * Contract not yet initialized.
   */
  109: {message:"NotInitialized"},
  /**
   * Sender and recipient must be different addresses.
   */
  110: {message:"SenderEqualsRecipient"}
}

/**
 * Errors specific to the Router contract.
 */
export const RouterError = {
  301: {message:"AlreadyInitialized"},
  302: {message:"NotInitialized"},
  303: {message:"NotAuthorized"},
  304: {message:"InvalidStreamType"}
}

/**
 * Storage keys for contract data.
 * 
 * Using a typed enum prevents key collisions (SKILL.md §3).
 * Keys are namespaced by variant to keep different data types separate.
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "NextStreamId", values: void} | {tag: "FlowStream", values: readonly [u64]} | {tag: "LockupStream", values: readonly [u64]} | {tag: "AggregateBalance", values: readonly [string]} | {tag: "TokenOwner", values: readonly [i128]} | {tag: "TokenStreamData", values: readonly [i128]} | {tag: "NftBalance", values: readonly [string]} | {tag: "TokenMetadata", values: readonly [string]} | {tag: "FlowContract", values: void} | {tag: "LockupContract", values: void} | {tag: "NftContract", values: void} | {tag: "AllowedFeeTokens", values: void};

export interface Client {
  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin can upgrade the router logic.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw tokens from a stream using the NFT.
   */
  withdraw: ({token_id, caller, to, amount}: {token_id: i128, caller: string, to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the Router with the addresses of the core contracts.
   */
  initialize: ({admin, flow_contract, lockup_contract, nft_contract}: {admin: string, flow_contract: string, lockup_contract: string, nft_contract: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade_nft transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin can upgrade the NFT contract logic.
   */
  upgrade_nft: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw_max transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw max tokens from a stream using the NFT.
   */
  withdraw_max: ({token_id, caller, to}: {token_id: i128, caller: string, to: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a create_flow_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a Flow stream and mint an NFT.
   */
  create_flow_stream: ({sender, recipient, token, rate_per_second, token_decimals, start_time}: {sender: string, recipient: string, token: string, rate_per_second: i128, token_decimals: u32, start_time: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a create_lockup_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a Lockup stream and mint an NFT.
   */
  create_lockup_stream: ({params}: {params: CreateLockupParams}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAACNBZG1pbiBjYW4gdXBncmFkZSB0aGUgcm91dGVyIGxvZ2ljLgAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAACxXaXRoZHJhdyB0b2tlbnMgZnJvbSBhIHN0cmVhbSB1c2luZyB0aGUgTkZULgAAAAh3aXRoZHJhdwAAAAQAAAAAAAAACHRva2VuX2lkAAAACwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAD9Jbml0aWFsaXplIHRoZSBSb3V0ZXIgd2l0aCB0aGUgYWRkcmVzc2VzIG9mIHRoZSBjb3JlIGNvbnRyYWN0cy4AAAAACmluaXRpYWxpemUAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAANZmxvd19jb250cmFjdAAAAAAAABMAAAAAAAAAD2xvY2t1cF9jb250cmFjdAAAAAATAAAAAAAAAAxuZnRfY29udHJhY3QAAAATAAAAAA==",
        "AAAAAAAAAClBZG1pbiBjYW4gdXBncmFkZSB0aGUgTkZUIGNvbnRyYWN0IGxvZ2ljLgAAAAAAAAt1cGdyYWRlX25mdAAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAADBXaXRoZHJhdyBtYXggdG9rZW5zIGZyb20gYSBzdHJlYW0gdXNpbmcgdGhlIE5GVC4AAAAMd2l0aGRyYXdfbWF4AAAAAwAAAAAAAAAIdG9rZW5faWQAAAALAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAACVDcmVhdGUgYSBGbG93IHN0cmVhbSBhbmQgbWludCBhbiBORlQuAAAAAAAAEmNyZWF0ZV9mbG93X3N0cmVhbQAAAAAABgAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAAD3JhdGVfcGVyX3NlY29uZAAAAAALAAAAAAAAAA50b2tlbl9kZWNpbWFscwAAAAAABAAAAAAAAAAKc3RhcnRfdGltZQAAAAAABgAAAAEAAAAL",
        "AAAAAAAAACdDcmVhdGUgYSBMb2NrdXAgc3RyZWFtIGFuZCBtaW50IGFuIE5GVC4AAAAAFGNyZWF0ZV9sb2NrdXBfc3RyZWFtAAAAAQAAAAAAAAAGcGFyYW1zAAAAAAfQAAAAEkNyZWF0ZUxvY2t1cFBhcmFtcwAAAAAAAQAAAAs=",
        "AAAAAQAAA3pDb3JlIGRhdGEgc3RydWN0dXJlIGZvciBhIEZsb3cgKG9wZW4tZW5kZWQsIHJhdGUtcGVyLXNlY29uZCkgc3RyZWFtLgoKUG9ydGVkIGZyb20gU2FibGllcidzIGBGbG93LlN0cmVhbWAgc3RydWN0IHdpdGggdGhlc2UgYWRhcHRhdGlvbnM6CgotIGBVRDIxeDE4IHJhdGVQZXJTZWNvbmRgIOKGkiBgaTEyOCByYXRlX3Blcl9zZWNvbmRgIHNjYWxlZCB0byAxOCBkZWNpbWFscy4KU29yb2JhbiBoYXMgbm8gbmF0aXZlIGZpeGVkLXBvaW50IHR5cGUsIHNvIHdlIHVzZSBpMTI4IHdpdGggbWFudWFsIHNjYWxpbmcuCkEgcmF0ZSBvZiAxIHRva2VuL3NlYyBmb3IgYSA3LWRlY2ltYWwgdG9rZW4gPSAxZTE4IGludGVybmFsbHkuCgotIGBJRVJDMjAgdG9rZW5gIOKGkiBgQWRkcmVzc2AgKFNvcm9iYW4gdG9rZW4gY29udHJhY3QgYWRkcmVzcykuCgotIGB1aW50MTI4IGJhbGFuY2VgIOKGkiBgaTEyOGAgKFNvcm9iYW4gU0RLIGNvbnZlbnRpb24gZm9yIHRva2VuIGFtb3VudHMpLgoKLSBgdWludDQwIHNuYXBzaG90VGltZWAg4oaSIGB1NjRgIChTb3JvYmFuIGxlZGdlciB0aW1lc3RhbXAgaXMgdTY0KS4KCi0gYGJvb2wgaXNTdHJlYW1gIHNlbnRpbmVsIHJlbW92ZWQg4oCUIHdlIHVzZSBzdG9yYWdlIGtleSBleGlzdGVuY2UgaW5zdGVhZC4KCi0gYGJvb2wgaXNUcmFuc2ZlcmFibGVgIHJlbW92ZWQg4oCUIGRlbGVnYXRlZCB0byB0aGUgTkZUIGNvbnRyYWN0IGxheWVyLgoKIyBTdG9yYWdlIExheW91dAoKRWFjaCBzdHJlYW0gaXMgc3RvcmVkIHVuZGVyIGBEYXRhS2V5OjpTdHJlYW0oc3RyZWFtX2lkKWAgaW4gcGVyc2lzdGVudCBzdG9yYWdlLgpUaGUgc3RydWN0IGlzIGtlcHQgYXMgZmxhdCBhcyBwb3NzaWJsZSB0byBtaW5pbWl6ZSBzZXJpYWxpemF0aW9uIG92ZXJoZWFkLgAAAAAAAAAAAApGbG93U3RyZWFtAAAAAAAJAAAATkN1cnJlbnQgYmFsYW5jZSBoZWxkIGluIHRoZSBzdHJlYW0gKGRlcG9zaXRlZCAtIHdpdGhkcmF3biksIGluIHRva2VuIGRlY2ltYWxzLgAAAAAAB2JhbGFuY2UAAAAACwAAAC9XaGV0aGVyIHRoZSBzdHJlYW0gaGFzIGJlZW4gcGVybWFuZW50bHkgdm9pZGVkLgAAAAAJaXNfdm9pZGVkAAAAAAAAAQAAAKVSYXRlIGF0IHdoaWNoIGRlYnQgYWNjcnVlcywgaW4gMTgtZGVjaW1hbCBmaXhlZC1wb2ludC4KMCBtZWFucyB0aGUgc3RyZWFtIGlzIHBhdXNlZC4KRXhhbXBsZTogMSB0b2tlbi9zZWMgZm9yIGEgNy1kZWNpbWFsIHRva2VuIOKGkiAxXzAwMF8wMDBfMDAwXzAwMF8wMDBfMDAwICgxZTE4KS4AAAAAAAAPcmF0ZV9wZXJfc2Vjb25kAAAAAAsAAAAwVGhlIGFkZHJlc3MgcmVjZWl2aW5nIHRoZSB0b2tlbnMgKGNhbiB3aXRoZHJhdykuAAAACXJlY2lwaWVudAAAAAAAABMAAAA9VGhlIGFkZHJlc3Mgc3RyZWFtaW5nIHRoZSB0b2tlbnMgKGNhbiBwYXVzZSwgYWRqdXN0LCByZWZ1bmQpLgAAAAAAAAZzZW5kZXIAAAAAABMAAAB6QWNjdW11bGF0ZWQgZGVidCBhdCB0aGUgbGFzdCBzbmFwc2hvdCwgaW4gMTgtZGVjaW1hbCBmaXhlZC1wb2ludC4KVG90YWwgZGVidCA9IHNuYXBzaG90X2RlYnRfc2NhbGVkICsgb25nb2luZ19kZWJ0X3NjYWxlZC4AAAAAABRzbmFwc2hvdF9kZWJ0X3NjYWxlZAAAAAsAAABkVW5peCB0aW1lc3RhbXAgb2YgdGhlIGxhc3QgZGVidCBzbmFwc2hvdC4KRGVidCBhY2NydWVzIGZyb20gdGhpcyBwb2ludCBmb3J3YXJkIGF0IGByYXRlX3Blcl9zZWNvbmRgLgAAAA1zbmFwc2hvdF90aW1lAAAAAAAABgAAADpUaGUgU29yb2JhbiB0b2tlbiBjb250cmFjdCBhZGRyZXNzIChTQUMgb3IgY3VzdG9tIFNFUC00MSkuAAAAAAAFdG9rZW4AAAAAAAATAAAAbU51bWJlciBvZiBkZWNpbWFscyBmb3IgdGhlIHRva2VuIChlLmcuIDcgZm9yIG1vc3QgU3RlbGxhciBhc3NldHMpLgpVc2VkIGZvciBzY2FsZS9kZXNjYWxlIG9wZXJhdGlvbnMuIE1heCAxOC4AAAAAAAAOdG9rZW5fZGVjaW1hbHMAAAAAAAQ=",
        "AAAAAwAAAGhUeXBlIG9mIHN0cmVhbSAoRmxvdyBvciBMb2NrdXApLgpVc2VkIGJ5IHRoZSBTdHJlYW0gTkZUIGFuZCBSb3V0ZXIgdG8gcm91dGUgbG9naWMgdG8gdGhlIGNvcnJlY3QgZW5naW5lLgAAAAAAAAAKU3RyZWFtVHlwZQAAAAAAAgAAAAAAAAAERmxvdwAAAAAAAAAAAAAABkxvY2t1cAAAAAAAAQ==",
        "AAAAAwAAAMtTdGF0dXMgb2YgYSBMb2NrdXAgc3RyZWFtLgoKVXNlcyAidGVtcGVyYXR1cmUiIHNlbWFudGljczoKLSAqKldhcm0qKiAoUGVuZGluZywgU3RyZWFtaW5nKTogdGltZSBhbG9uZSBjYW4gY2hhbmdlIHRoZSBzdGF0dXMuCi0gKipDb2xkKiogKFNldHRsZWQsIENhbmNlbGVkLCBEZXBsZXRlZCk6IHRpbWUgYWxvbmUgY2Fubm90IGNoYW5nZSB0aGUgc3RhdHVzLgAAAAAAAAAADExvY2t1cFN0YXR1cwAAAAUAAAA/Q3JlYXRlZCBidXQgc3RhcnRfdGltZSBpcyBpbiB0aGUgZnV0dXJlLiBObyB0b2tlbnMgaGF2ZSB2ZXN0ZWQuAAAAAAdQZW5kaW5nAAAAAAAAAAAyQWN0aXZlIOKAlCB0b2tlbnMgYXJlIGN1cnJlbnRseSB2ZXN0aW5nIG92ZXIgdGltZS4AAAAAAAlTdHJlYW1pbmcAAAAAAAABAAAAS0FsbCB0b2tlbnMgaGF2ZSBmdWxseSB2ZXN0ZWQuIFJlY2lwaWVudCBjYW4gd2l0aGRyYXcgdGhlIHJlbWFpbmluZyBiYWxhbmNlLgAAAAAHU2V0dGxlZAAAAAACAAAAP1NlbmRlciBjYW5jZWxlZCB0aGUgc3RyZWFtLiBVbnZlc3RlZCB0b2tlbnMgcmV0dXJuZWQgdG8gc2VuZGVyLgAAAAAIQ2FuY2VsZWQAAAADAAAAQkZ1bGx5IHdpdGhkcmF3biAoYW5kL29yIHJlZnVuZGVkKS4gTm8gdG9rZW5zIHJlbWFpbiBpbiB0aGUgc3RyZWFtLgAAAAAACERlcGxldGVkAAAABA==",
        "AAAAAQAAAtxDb3JlIGRhdGEgc3RydWN0dXJlIGZvciBhIExvY2t1cCAoZml4ZWQtdGVybSB2ZXN0aW5nKSBzdHJlYW0uCgpTdXBwb3J0cyBsaW5lYXIgdW5sb2NrIHdpdGggb3B0aW9uYWwgY2xpZmYuIFRoZSB2ZXN0ZWQgKCJzdHJlYW1lZCIpIGFtb3VudAphdCBhbnkgdGltZSBgdGAgaXMgY2FsY3VsYXRlZCBhczoKCmBgYHRleHQKaWYgdCA8IHN0YXJ0X3RpbWU6ICAgICAgIHZlc3RlZCA9IDAKaWYgdCA8IGNsaWZmX3RpbWU6ICAgICAgIHZlc3RlZCA9IHN0YXJ0X3VubG9ja19hbW91bnQKaWYgdCA+PSBlbmRfdGltZTogICAgICAgICB2ZXN0ZWQgPSB0b3RhbF9hbW91bnQKZWxzZToKZWxhcHNlZCA9IGZsb29yKCh0IC0gY2xpZmZfdGltZSkgLyBncmFudWxhcml0eSkgKiBncmFudWxhcml0eQpzdHJlYW1hYmxlX2R1cmF0aW9uID0gZW5kX3RpbWUgLSBjbGlmZl90aW1lCnN0cmVhbWFibGVfYW1vdW50ID0gdG90YWxfYW1vdW50IC0gc3RhcnRfdW5sb2NrX2Ftb3VudCAtIGNsaWZmX3VubG9ja19hbW91bnQKdmVzdGVkID0gc3RhcnRfdW5sb2NrX2Ftb3VudCArIGNsaWZmX3VubG9ja19hbW91bnQgKyAoZWxhcHNlZCAqIHN0cmVhbWFibGVfYW1vdW50IC8gc3RyZWFtYWJsZV9kdXJhdGlvbikKYGBgCgpUaGlzIG1pcnJvcnMgdGhlIHJlZmVyZW5jZSBsaW5lYXIgbG9ja3VwIGNhbGN1bGF0aW9uIHdpdGggZGlzY3JldGUgdW5sb2NrCnN0ZXBzIGF0IGBncmFudWxhcml0eWAtc2Vjb25kIGludGVydmFscy4AAAAAAAAADExvY2t1cFN0cmVhbQAAAA8AAABGV2hldGhlciB0aGUgc2VuZGVyIGNhbiBjYW5jZWwgdGhpcyBzdHJlYW0gYW5kIHJlY2xhaW0gdW52ZXN0ZWQgdG9rZW5zLgAAAAAACmNhbmNlbGFibGUAAAAAAAEAAABuT3B0aW9uYWwgY2xpZmYgdGltZXN0YW1wLiBObyB0b2tlbnMgYmV5b25kIGBzdGFydF91bmxvY2tfYW1vdW50YAp2ZXN0IGJlZm9yZSB0aGlzIHRpbWUuIFNldCB0byAwIGZvciBubyBjbGlmZi4AAAAAAApjbGlmZl90aW1lAAAAAAAGAAAAR0Ftb3VudCB1bmxvY2tlZCBhdCBgY2xpZmZfdGltZWAgKGluIGFkZGl0aW9uIHRvIGBzdGFydF91bmxvY2tfYW1vdW50YCkuAAAAABNjbGlmZl91bmxvY2tfYW1vdW50AAAAAAsAAAAxVW5peCB0aW1lc3RhbXAgd2hlbiB0aGUgbG9ja3VwIGlzIGZ1bGx5IHVubG9ja2VkLgAAAAAAAAhlbmRfdGltZQAAAAYAAAB9VW5sb2NrIGdyYW51bGFyaXR5IGluIHNlY29uZHMuIFRva2VucyB2ZXN0IGluIGRpc2NyZXRlIHN0ZXBzIG9mIHRoaXMKaW50ZXJ2YWwuIERlZmF1bHQgPSAxIChwZXItc2Vjb25kIHZlc3RpbmcpLiBNdXN0IGJlID4gMC4AAAAAAAALZ3JhbnVsYXJpdHkAAAAABgAAADdXaGV0aGVyIGFsbCB0b2tlbnMgaGF2ZSBiZWVuIHdpdGhkcmF3biBhbmQvb3IgcmVmdW5kZWQuAAAAAAtpc19kZXBsZXRlZAAAAAABAAAAP1RoZSBhZGRyZXNzIHRoYXQgcmVjZWl2ZXMgdG9rZW5zIGFzIHRoZXkgdW5sb2NrIChjYW4gd2l0aGRyYXcpLgAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAEFBbW91bnQgcmVmdW5kZWQgdG8gc2VuZGVyIG9uIGNhbmNlbGxhdGlvbi4gWmVybyB1bmxlc3MgY2FuY2VsbGVkLgAAAAAAAA9yZWZ1bmRlZF9hbW91bnQAAAAACwAAAExUaGUgYWRkcmVzcyB0aGF0IGNyZWF0ZWQgYW5kIGZ1bmRlZCB0aGUgbG9ja3VwIChjYW4gY2FuY2VsIGlmIGBjYW5jZWxhYmxlYCkuAAAABnNlbmRlcgAAAAAAEwAAACZVbml4IHRpbWVzdGFtcCB3aGVuIHRoZSBsb2NrdXAgYmVnaW5zLgAAAAAACnN0YXJ0X3RpbWUAAAAAAAYAAAAsQW1vdW50IHVubG9ja2VkIGltbWVkaWF0ZWx5IGF0IGBzdGFydF90aW1lYC4AAAATc3RhcnRfdW5sb2NrX2Ftb3VudAAAAAALAAAAI1RoZSBTb3JvYmFuIHRva2VuIGNvbnRyYWN0IGFkZHJlc3MuAAAAAAV0b2tlbgAAAAAAABMAAAA7VG90YWwgYW1vdW50IGRlcG9zaXRlZCBpbnRvIHRoZSBzdHJlYW0gKGluIHRva2VuIGRlY2ltYWxzKS4AAAAADHRvdGFsX2Ftb3VudAAAAAsAAAAmV2hldGhlciB0aGUgc3RyZWFtIGhhcyBiZWVuIGNhbmNlbGxlZC4AAAAAAAx3YXNfY2FuY2VsZWQAAAABAAAALUN1bXVsYXRpdmUgYW1vdW50IHdpdGhkcmF3biBieSB0aGUgcmVjaXBpZW50LgAAAAAAABB3aXRoZHJhd25fYW1vdW50AAAACw==",
        "AAAAAwAAALFTdGF0dXMgb2YgYSBGbG93IHN0cmVhbS4KClRoZSBzdGF0dXMgaXMgZGVyaXZlZCBmcm9tIHRoZSBzdHJlYW0ncyBjdXJyZW50IHN0YXRlIChyYXRlLCBiYWxhbmNlLCBkZWJ0LCB2b2lkZWQgZmxhZykgcmF0aGVyIHRoYW4KYmVpbmcgc3RvcmVkIGRpcmVjdGx5IOKAlCBrZWVwaW5nIHN0b3JhZ2UgbWluaW1hbC4AAAAAAAAAAAAADFN0cmVhbVN0YXR1cwAAAAYAAAA+U3RyZWFtIHNjaGVkdWxlZCB0byBzdGFydCBpbiB0aGUgZnV0dXJlIChzbmFwc2hvdF90aW1lID4gbm93KS4AAAAAAAdQZW5kaW5nAAAAAAAAAAAyQWN0aXZlbHkgc3RyZWFtaW5nIHdpdGggYmFsYW5jZSBjb3ZlcmluZyBhbGwgZGVidC4AAAAAABBTdHJlYW1pbmdTb2x2ZW50AAAAAQAAADZBY3RpdmVseSBzdHJlYW1pbmcgYnV0IGRlYnQgZXhjZWVkcyBhdmFpbGFibGUgYmFsYW5jZS4AAAAAABJTdHJlYW1pbmdJbnNvbHZlbnQAAAAAAAIAAAAoUGF1c2VkIGJ5IHNlbmRlciB3aXRoIG5vIHVuY292ZXJlZCBkZWJ0LgAAAA1QYXVzZWRTb2x2ZW50AAAAAAAAAwAAACVQYXVzZWQgYnkgc2VuZGVyIHdpdGggdW5jb3ZlcmVkIGRlYnQuAAAAAAAAD1BhdXNlZEluc29sdmVudAAAAAAEAAAARVBlcm1hbmVudGx5IHN0b3BwZWQuIENhbm5vdCBiZSByZXN0YXJ0ZWQuIFVuY292ZXJlZCBkZWJ0IHdyaXR0ZW4gb2ZmLgAAAAAAAAZWb2lkZWQAAAAAAAU=",
        "AAAAAQAAAINQYXJhbWV0ZXJzIGZvciBjcmVhdGluZyBhIG5ldyBMb2NrdXAgc3RyZWFtLgoKQnVuZGxlZCBpbnRvIGEgc3RydWN0IGJlY2F1c2UgU29yb2JhbiBjb250cmFjdCBmdW5jdGlvbnMKaGF2ZSBhIG1heCBvZiAxMCBwYXJhbWV0ZXJzLgAAAAAAAAAAEkNyZWF0ZUxvY2t1cFBhcmFtcwAAAAAACwAAAClXaGV0aGVyIHRoZSBzZW5kZXIgY2FuIGNhbmNlbCB0aGUgc3RyZWFtLgAAAAAAAApjYW5jZWxhYmxlAAAAAAABAAAAME9wdGlvbmFsIGNsaWZmIHRpbWVzdGFtcC4gU2V0IHRvIDAgZm9yIG5vIGNsaWZmLgAAAApjbGlmZl90aW1lAAAAAAAGAAAAKlRva2VucyB1bmxvY2tlZCBhdCBjbGlmZiAoYWRkZWQgdG8gc3RhcnQpLgAAAAAAE2NsaWZmX3VubG9ja19hbW91bnQAAAAACwAAACZVbml4IHRpbWVzdGFtcCB3aGVuIHZlc3RpbmcgY29tcGxldGVzLgAAAAAACGVuZF90aW1lAAAABgAAADFVbmxvY2sgc3RlcCBpbnRlcnZhbCBpbiBzZWNvbmRzLiAwIGRlZmF1bHRzIHRvIDEuAAAAAAAAC2dyYW51bGFyaXR5AAAAAAYAAAAgQWRkcmVzcyByZWNlaXZpbmcgdmVzdGVkIHRva2Vucy4AAAAJcmVjaXBpZW50AAAAAAAAEwAAADhBZGRyZXNzIGZ1bmRpbmcgdGhlIHN0cmVhbSAoY2FuIGNhbmNlbCBpZiBgY2FuY2VsYWJsZWApLgAAAAZzZW5kZXIAAAAAABMAAAAjVW5peCB0aW1lc3RhbXAgd2hlbiB2ZXN0aW5nIGJlZ2lucy4AAAAACnN0YXJ0X3RpbWUAAAAAAAYAAAAlVG9rZW5zIHVubG9ja2VkIGltbWVkaWF0ZWx5IGF0IHN0YXJ0LgAAAAAAABNzdGFydF91bmxvY2tfYW1vdW50AAAAAAsAAAAfU29yb2JhbiB0b2tlbiBjb250cmFjdCBhZGRyZXNzLgAAAAAFdG9rZW4AAAAAAAATAAAAKVRvdGFsIHRva2VucyB0byB2ZXN0IChpbiB0b2tlbiBkZWNpbWFscykuAAAAAAAADHRvdGFsX2Ftb3VudAAAAAs=",
        "AAAABAAAACtFcnJvcnMgc3BlY2lmaWMgdG8gdGhlIFN0cmVhbSBORlQgY29udHJhY3QuAAAAAAAAAAAITmZ0RXJyb3IAAAAFAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAMkAAAAAAAAADU5vdEF1dGhvcml6ZWQAAAAAAADKAAAAAAAAAA1Ub2tlbk5vdEZvdW5kAAAAAAAAywAAAAAAAAAPTm90VHJhbnNmZXJhYmxlAAAAAMwAAAAhVG9rZW4gSUQgaGFzIGFscmVhZHkgYmVlbiBtaW50ZWQuAAAAAAAADUFscmVhZHlNaW50ZWQAAAAAAADN",
        "AAAABAAAAC5FcnJvcnMgZW1pdHRlZCBieSB0aGUgRmxvdyBzdHJlYW1pbmcgY29udHJhY3QuAAAAAAAAAAAACUZsb3dFcnJvcgAAAAAAABUAAAAZU3RyZWFtIElEIGRvZXMgbm90IGV4aXN0LgAAAAAAAA5TdHJlYW1Ob3RGb3VuZAAAAAAAAQAAACxDYWxsZXIgaXMgbm90IGF1dGhvcml6ZWQgZm9yIHRoaXMgb3BlcmF0aW9uLgAAAAxVbmF1dGhvcml6ZWQAAAACAAAANlN0cmVhbSBpcyBwYXVzZWQ7IG9wZXJhdGlvbiByZXF1aXJlcyBhY3RpdmUgc3RyZWFtaW5nLgAAAAAADFN0cmVhbVBhdXNlZAAAAAMAAAAvU3RyZWFtIGlzIHZvaWRlZDsgbm8gZnVydGhlciBtdXRhdGlvbnMgYWxsb3dlZC4AAAAADFN0cmVhbVZvaWRlZAAAAAQAAAA3U3RyZWFtIGlzIG5vdCBwYXVzZWQ7IHJlc3RhcnQgcmVxdWlyZXMgYSBwYXVzZWQgc3RyZWFtLgAAAAAPU3RyZWFtTm90UGF1c2VkAAAAAAUAAAA5U3RyZWFtIGhhcyBub3Qgc3RhcnRlZCB5ZXQgKHNuYXBzaG90X3RpbWUgaW4gdGhlIGZ1dHVyZSkuAAAAAAAADVN0cmVhbVBlbmRpbmcAAAAAAAAGAAAAIE5ldyByYXRlIHBlciBzZWNvbmQgbXVzdCBiZSA+IDAuAAAAEVJhdGVQZXJTZWNvbmRaZXJvAAAAAAAABwAAACdOZXcgcmF0ZSBtdXN0IGRpZmZlciBmcm9tIGN1cnJlbnQgcmF0ZS4AAAAAEFJhdGVOb3REaWZmZXJlbnQAAAAIAAAAG0RlcG9zaXQgYW1vdW50IG11c3QgYmUgPiAwLgAAAAARRGVwb3NpdEFtb3VudFplcm8AAAAAAAAJAAAAHFdpdGhkcmF3IGFtb3VudCBtdXN0IGJlID4gMC4AAAASV2l0aGRyYXdBbW91bnRaZXJvAAAAAAAKAAAALVdpdGhkcmF3IGFtb3VudCBleGNlZWRzIHdpdGhkcmF3YWJsZSBiYWxhbmNlLgAAAAAAAAhPdmVyZHJhdwAAAAsAAAAaUmVmdW5kIGFtb3VudCBtdXN0IGJlID4gMC4AAAAAABBSZWZ1bmRBbW91bnRaZXJvAAAADAAAAClSZWZ1bmQgYW1vdW50IGV4Y2VlZHMgcmVmdW5kYWJsZSBiYWxhbmNlLgAAAAAAAA5SZWZ1bmRPdmVyZmxvdwAAAAAADQAAACVUb2tlbiBoYXMgPiAxOCBkZWNpbWFscywgdW5zdXBwb3J0ZWQuAAAAAAAAFEludmFsaWRUb2tlbkRlY2ltYWxzAAAADgAAADZTdHJlYW0gYmFsYW5jZSBpcyB6ZXJvIChlLmcuIHF1ZXJ5aW5nIGRlcGxldGlvbiB0aW1lKS4AAAAAAAtCYWxhbmNlWmVybwAAAAAPAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGl6ZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAEAAAAB1Db250cmFjdCBub3QgeWV0IGluaXRpYWxpemVkLgAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAEQAAADhDYW5ub3QgY3JlYXRlIGEgcGVuZGluZyBzdHJlYW0gd2l0aCByYXRlX3Blcl9zZWNvbmQgPSAwLgAAABdDcmVhdGVSYXRlUGVyU2Vjb25kWmVybwAAAAASAAAAOUludGVybmFsIG1hdGggZXJyb3Ig4oCUIHNob3VsZCBuZXZlciBvY2N1ciBpbiBwcm9kdWN0aW9uLgAAAAAAABJJbnZhbGlkQ2FsY3VsYXRpb24AAAAAABMAAAAxU2VuZGVyIGFuZCByZWNpcGllbnQgbXVzdCBiZSBkaWZmZXJlbnQgYWRkcmVzc2VzLgAAAAAAABVTZW5kZXJFcXVhbHNSZWNpcGllbnQAAAAAAAAUAAAAJVJhdGUgcGVyIHNlY29uZCBtdXN0IG5vdCBiZSBuZWdhdGl2ZS4AAAAAAAAMTmVnYXRpdmVSYXRlAAAAFQ==",
        "AAAABAAAAC5FcnJvcnMgZW1pdHRlZCBieSB0aGUgTG9ja3VwIHZlc3RpbmcgY29udHJhY3QuAAAAAAAAAAAAC0xvY2t1cEVycm9yAAAAAAoAAAAZU3RyZWFtIElEIGRvZXMgbm90IGV4aXN0LgAAAAAAAA5TdHJlYW1Ob3RGb3VuZAAAAAAAZQAAABlDYWxsZXIgaXMgbm90IGF1dGhvcml6ZWQuAAAAAAAADFVuYXV0aG9yaXplZAAAAGYAAAAcU3RyZWFtIGlzIGFscmVhZHkgY2FuY2VsbGVkLgAAABBBbHJlYWR5Q2FuY2VsbGVkAAAAZwAAABlTdHJlYW0gaXMgbm90IGNhbmNlbGFibGUuAAAAAAAADU5vdENhbmNlbGFibGUAAAAAAABoAAAAKVdpdGhkcmF3IGFtb3VudCBleGNlZWRzIHVubG9ja2VkIGJhbGFuY2UuAAAAAAAACE92ZXJkcmF3AAAAaQAAADxJbnZhbGlkIHRpbWUgcGFyYW1ldGVycyAoc3RhcnQgPj0gZW5kLCBjbGlmZiBvdXRzaWRlIHJhbmdlKS4AAAAQSW52YWxpZFRpbWVSYW5nZQAAAGoAAAAZVG90YWwgYW1vdW50IG11c3QgYmUgPiAwLgAAAAAAAApBbW91bnRaZXJvAAAAAABrAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGl6ZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAbAAAAB1Db250cmFjdCBub3QgeWV0IGluaXRpYWxpemVkLgAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAbQAAADFTZW5kZXIgYW5kIHJlY2lwaWVudCBtdXN0IGJlIGRpZmZlcmVudCBhZGRyZXNzZXMuAAAAAAAAFVNlbmRlckVxdWFsc1JlY2lwaWVudAAAAAAAAG4=",
        "AAAABAAAACdFcnJvcnMgc3BlY2lmaWMgdG8gdGhlIFJvdXRlciBjb250cmFjdC4AAAAAAAAAAAtSb3V0ZXJFcnJvcgAAAAAEAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAS0AAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAEuAAAAAAAAAA1Ob3RBdXRob3JpemVkAAAAAAABLwAAAAAAAAARSW52YWxpZFN0cmVhbVR5cGUAAAAAAAEw",
        "AAAAAgAAAKFTdG9yYWdlIGtleXMgZm9yIGNvbnRyYWN0IGRhdGEuCgpVc2luZyBhIHR5cGVkIGVudW0gcHJldmVudHMga2V5IGNvbGxpc2lvbnMgKFNLSUxMLm1kIMKnMykuCktleXMgYXJlIG5hbWVzcGFjZWQgYnkgdmFyaWFudCB0byBrZWVwIGRpZmZlcmVudCBkYXRhIHR5cGVzIHNlcGFyYXRlLgAAAAAAAAAAAAAHRGF0YUtleQAAAAANAAAAAAAAACFBZG1pbiBhZGRyZXNzIChJbnN0YW5jZSBzdG9yYWdlKS4AAAAAAAAFQWRtaW4AAAAAAAAAAAAAKk5leHQgc3RyZWFtIElEIGNvdW50ZXIgKEluc3RhbmNlIHN0b3JhZ2UpLgAAAAAADE5leHRTdHJlYW1JZAAAAAEAAAA+QSBGbG93IHN0cmVhbSByZWNvcmQsIGtleWVkIGJ5IHN0cmVhbSBJRCAoUGVyc2lzdGVudCBzdG9yYWdlKS4AAAAAAApGbG93U3RyZWFtAAAAAAABAAAABgAAAAEAAABAQSBMb2NrdXAgc3RyZWFtIHJlY29yZCwga2V5ZWQgYnkgc3RyZWFtIElEIChQZXJzaXN0ZW50IHN0b3JhZ2UpLgAAAAxMb2NrdXBTdHJlYW0AAAABAAAABgAAAAEAAACTQWdncmVnYXRlIHRva2VuIGJhbGFuY2UgaGVsZCBieSB0aGUgY29udHJhY3QgZm9yIGEgZ2l2ZW4gdG9rZW4gYWRkcmVzcy4KVXNlZCBmb3Igc3VycGx1cyByZWNvdmVyeSAvIGFjY291bnRpbmcgcmVjb25jaWxpYXRpb24gKFBlcnNpc3RlbnQgc3RvcmFnZSkuAAAAABBBZ2dyZWdhdGVCYWxhbmNlAAAAAQAAABMAAAABAAAAOE5GVCB0b2tlbiBvd25lciwga2V5ZWQgYnkgdG9rZW4gSUQgKFBlcnNpc3RlbnQgc3RvcmFnZSkuAAAAClRva2VuT3duZXIAAAAAAAEAAAALAAAAAQAAAExORlQgc3RyZWFtIGRhdGEgbWFwcGluZyB0b2tlbiBJRCB0byBzdHJlYW0gdHlwZSBhbmQgSUQgKFBlcnNpc3RlbnQgc3RvcmFnZSkuAAAAD1Rva2VuU3RyZWFtRGF0YQAAAAABAAAACwAAAAEAAAA4TnVtYmVyIG9mIE5GVHMgb3duZWQgYnkgYW4gYWRkcmVzcyAoUGVyc2lzdGVudCBzdG9yYWdlKS4AAAAKTmZ0QmFsYW5jZQAAAAAAAQAAABMAAAABAAAAO1Rva2VuIG1ldGFkYXRhLCBlLmcuLCBuYW1lLCBzeW1ib2wsIFVSSSAoSW5zdGFuY2Ugc3RvcmFnZSkuAAAAAA1Ub2tlbk1ldGFkYXRhAAAAAAAAAQAAABEAAAAAAAAALFJvdXRlciBjb25maWd1cmF0aW9uOiBGbG93IGNvbnRyYWN0IGFkZHJlc3MuAAAADEZsb3dDb250cmFjdAAAAAAAAAAuUm91dGVyIGNvbmZpZ3VyYXRpb246IExvY2t1cCBjb250cmFjdCBhZGRyZXNzLgAAAAAADkxvY2t1cENvbnRyYWN0AAAAAAAAAAAAK1JvdXRlciBjb25maWd1cmF0aW9uOiBORlQgY29udHJhY3QgYWRkcmVzcy4AAAAAC05mdENvbnRyYWN0AAAAAAAAAAA9UGF5bWFzdGVyIGNvbmZpZ3VyYXRpb246IGxpc3Qgb2YgYWxsb3dlZCBmZWUgdG9rZW4gYWRkcmVzc2VzLgAAAAAAABBBbGxvd2VkRmVlVG9rZW5z" ]),
      options
    )
  }
  public readonly fromJSON = {
    upgrade: this.txFromJSON<null>,
        withdraw: this.txFromJSON<null>,
        initialize: this.txFromJSON<null>,
        upgrade_nft: this.txFromJSON<null>,
        withdraw_max: this.txFromJSON<i128>,
        create_flow_stream: this.txFromJSON<i128>,
        create_lockup_stream: this.txFromJSON<i128>
  }
}
