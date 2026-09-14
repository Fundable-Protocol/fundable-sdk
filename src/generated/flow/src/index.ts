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
  21: {message:"NegativeRate"},
  /**
   * Token transfer resulted in a different balance change than requested.
   */
  22: {message:"TokenTransferMismatch"},
  /**
   * Caller-supplied token decimals do not match the token contract.
   */
  23: {message:"TokenDecimalsMismatch"},
  /**
   * Checked arithmetic operation failed (overflow/underflow).
   */
  24: {message:"ArithmeticError"},
  /**
   * Admin transfer already pending.
   */
  25: {message:"AdminTransferPending"},
  /**
   * No admin transfer pending to accept.
   */
  26: {message:"NoAdminTransferPending"},
  /**
   * Upgrade is timelocked and cannot be executed yet.
   */
  27: {message:"UpgradeTimelocked"},
  /**
   * No upgrade has been proposed.
   */
  28: {message:"NoUpgradeProposed"}
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
  110: {message:"SenderEqualsRecipient"},
  /**
   * start_unlock_amount or cliff_unlock_amount is negative.
   */
  111: {message:"NegativeUnlockAmount"},
  /**
   * Checked addition of unlock amounts overflowed.
   */
  112: {message:"UnlockSumOverflow"},
  /**
   * Unlock sum is not in the valid range [0, total_amount].
   */
  113: {message:"InvalidUnlockSum"},
  /**
   * Defensive cancellation amount validation failed.
   */
  114: {message:"InvalidCancellationAmount"},
  /**
   * Token transfer resulted in a different balance change than requested.
   */
  115: {message:"TokenTransferMismatch"},
  /**
   * Checked arithmetic operation failed (overflow/underflow).
   */
  116: {message:"ArithmeticError"},
  /**
   * Admin transfer already pending.
   */
  117: {message:"AdminTransferPending"},
  /**
   * No admin transfer pending to accept.
   */
  118: {message:"NoAdminTransferPending"},
  /**
   * Upgrade is timelocked and cannot be executed yet.
   */
  119: {message:"UpgradeTimelocked"},
  /**
   * No upgrade has been proposed.
   */
  120: {message:"NoUpgradeProposed"}
}

/**
 * Errors specific to the Router contract.
 */
export const RouterError = {
  301: {message:"AlreadyInitialized"},
  302: {message:"NotInitialized"},
  303: {message:"NotAuthorized"},
  304: {message:"InvalidStreamType"},
  /**
   * A required contract address is invalid (zero/unset).
   */
  305: {message:"InvalidContractAddress"}
}

/**
 * Storage keys for contract data.
 * 
 * Using a typed enum prevents key collisions (SKILL.md §3).
 * Keys are namespaced by variant to keep different data types separate.
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "NextStreamId", values: void} | {tag: "FlowStream", values: readonly [u64]} | {tag: "LockupStream", values: readonly [u64]} | {tag: "AggregateBalance", values: readonly [string]} | {tag: "TokenOwner", values: readonly [i128]} | {tag: "TokenStreamData", values: readonly [i128]} | {tag: "NftBalance", values: readonly [string]} | {tag: "TokenMetadata", values: readonly [string]} | {tag: "FlowContract", values: void} | {tag: "LockupContract", values: void} | {tag: "NftContract", values: void} | {tag: "AllowedFeeTokens", values: void} | {tag: "PendingAdmin", values: void} | {tag: "ProposedUpgrade", values: readonly [Buffer]} | {tag: "UpgradeUnlockLedger", values: void};

export interface Client {
  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pause an active stream.
   * 
   * Sender-only. Snapshots ongoing debt and sets rate to 0.
   */
  pause: ({stream_id, sender}: {stream_id: u64, sender: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a new Flow stream.
   * 
   * The stream starts with zero balance. Use `deposit()` or
   * `create_and_deposit()` to fund it.
   * 
   * # Arguments
   * * `sender` — Address streaming the tokens (can pause/adjust/refund).
   * * `recipient` — Address receiving the tokens (can withdraw).
   * * `token` — Soroban token contract address (SAC or SEP-41).
   * * `rate_per_second` — Debt accrual rate in 18-decimal fixed-point.
   * * `token_decimals` — Token's decimal count (≤ 18).
   * * `start_time` — Unix timestamp to start. 0 = start now.
   * 
   * # Returns
   * The newly assigned stream ID.
   */
  create: ({sender, recipient, token, rate_per_second, token_decimals, start_time}: {sender: string, recipient: string, token: string, rate_per_second: i128, token_decimals: u32, start_time: u64}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Refund excess balance from a stream back to the sender.
   * 
   * Sender-only. Only unowed tokens can be refunded.
   */
  refund: ({stream_id, sender, amount}: {stream_id: u64, sender: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit tokens into an existing stream.
   * 
   * Anyone can fund a stream, but `funder.require_auth()` is needed
   * for the token transfer authorization.
   */
  deposit: ({stream_id, funder, amount}: {stream_id: u64, funder: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a restart transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Restart a paused stream with a new rate.
   * 
   * Sender-only. The stream must be paused and not voided.
   */
  restart: ({stream_id, sender, rate_per_second}: {stream_id: u64, sender: string, rate_per_second: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Emergency upgrade — bypasses timelock. Use only in critical situations.
   * Emits an upgrade event for auditing.
   * 
   * Admin-only. Consider removing this function after initial mainnet
   * stabilization, or requiring a separate emergency key.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw accrued tokens from a stream.
   * 
   * Only the stream recipient can withdraw. The withdrawn amount is
   * capped at the covered debt (balance-backed portion of total debt).
   */
  withdraw: ({stream_id, caller, to, amount}: {stream_id: u64, caller: string, to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Direct admin transfer (legacy, kept for backwards compatibility).
   * 
   * Admin-only. Prefer `propose_admin` + `accept_admin` for safety.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a status_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the stream's current status.
   */
  status_of: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<StreamStatus>>

  /**
   * Construct and simulate a get_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the full stream record.
   */
  get_stream: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<FlowStream>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the contract with an admin address.
   * 
   * Must be called exactly once before any other function.
   * The intended admin must authorize the initialization to prevent
   * first-caller takeover attacks.
   */
  initialize: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a refund_max transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Refund the maximum refundable amount.
   * 
   * Sender-only. Returns the amount refunded.
   */
  refund_max: ({stream_id, sender}: {stream_id: u64, sender: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a adjust_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Adjust the rate per second of an active stream.
   * 
   * Sender-only. The stream must be actively streaming (not paused/voided).
   */
  adjust_rate: ({stream_id, sender, new_rate}: {stream_id: u64, sender: string, new_rate: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the stream's current balance.
   */
  get_balance: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a void_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Permanently void a stream.
   * 
   * Callable by sender OR recipient. Writes off uncovered debt and
   * prevents the stream from being restarted.
   */
  void_stream: ({stream_id, caller}: {stream_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accept an admin transfer (two-step transfer, step 2).
   * 
   * Must be called by the address that was proposed via `propose_admin()`.
   */
  accept_admin: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw_max transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw the maximum available amount from a stream.
   * 
   * Convenience function — withdraws the entire covered debt.
   */
  withdraw_max: ({stream_id, caller, to}: {stream_id: u64, caller: string, to: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Propose a new admin (two-step transfer, step 1).
   * 
   * The proposed admin must call `accept_admin()` to complete the transfer.
   * Admin-only.
   */
  propose_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a total_debt_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the total debt owed (may exceed balance).
   */
  total_debt_of: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a covered_debt_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the covered debt (debt backed by balance).
   */
  covered_debt_of: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a execute_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Execute a previously proposed upgrade after the timelock has expired.
   * 
   * Admin-only.
   */
  execute_upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a propose_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Propose a timelocked upgrade. The upgrade can be executed after
   * UPGRADE_TIMELOCK_LEDGERS have passed.
   * 
   * Admin-only.
   */
  propose_upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a depletion_time_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the time at which the stream's balance will be depleted.
   */
  depletion_time_of: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a extend_stream_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Extend the TTL of a specific stream record.
   * 
   * Anyone can call this to keep a long-duration stream alive.
   * Does not modify stream state.
   */
  extend_stream_ttl: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a uncovered_debt_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the uncovered debt (debt exceeding balance).
   */
  uncovered_debt_of: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a create_and_deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a new Flow stream and immediately deposit tokens.
   * 
   * Convenience function combining `create()` + `deposit()`.
   */
  create_and_deposit: ({sender, recipient, token, rate_per_second, token_decimals, start_time, amount}: {sender: string, recipient: string, token: string, rate_per_second: i128, token_decimals: u32, start_time: u64, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a get_rate_per_second transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the stream's rate per second.
   */
  get_rate_per_second: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a refundable_amount_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the refundable amount (excess balance not owed).
   */
  refundable_amount_of: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a withdrawable_amount_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the amount withdrawable by the recipient.
   */
  withdrawable_amount_of: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

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
      new ContractSpec([ "AAAAAAAAAFBQYXVzZSBhbiBhY3RpdmUgc3RyZWFtLgoKU2VuZGVyLW9ubHkuIFNuYXBzaG90cyBvbmdvaW5nIGRlYnQgYW5kIHNldHMgcmF0ZSB0byAwLgAAAAVwYXVzZQAAAAAAAAIAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAiZDcmVhdGUgYSBuZXcgRmxvdyBzdHJlYW0uCgpUaGUgc3RyZWFtIHN0YXJ0cyB3aXRoIHplcm8gYmFsYW5jZS4gVXNlIGBkZXBvc2l0KClgIG9yCmBjcmVhdGVfYW5kX2RlcG9zaXQoKWAgdG8gZnVuZCBpdC4KCiMgQXJndW1lbnRzCiogYHNlbmRlcmAg4oCUIEFkZHJlc3Mgc3RyZWFtaW5nIHRoZSB0b2tlbnMgKGNhbiBwYXVzZS9hZGp1c3QvcmVmdW5kKS4KKiBgcmVjaXBpZW50YCDigJQgQWRkcmVzcyByZWNlaXZpbmcgdGhlIHRva2VucyAoY2FuIHdpdGhkcmF3KS4KKiBgdG9rZW5gIOKAlCBTb3JvYmFuIHRva2VuIGNvbnRyYWN0IGFkZHJlc3MgKFNBQyBvciBTRVAtNDEpLgoqIGByYXRlX3Blcl9zZWNvbmRgIOKAlCBEZWJ0IGFjY3J1YWwgcmF0ZSBpbiAxOC1kZWNpbWFsIGZpeGVkLXBvaW50LgoqIGB0b2tlbl9kZWNpbWFsc2Ag4oCUIFRva2VuJ3MgZGVjaW1hbCBjb3VudCAo4omkIDE4KS4KKiBgc3RhcnRfdGltZWAg4oCUIFVuaXggdGltZXN0YW1wIHRvIHN0YXJ0LiAwID0gc3RhcnQgbm93LgoKIyBSZXR1cm5zClRoZSBuZXdseSBhc3NpZ25lZCBzdHJlYW0gSUQuAAAAAAAGY3JlYXRlAAAAAAAGAAAAAAAAAAZzZW5kZXIAAAAAABMAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAPcmF0ZV9wZXJfc2Vjb25kAAAAAAsAAAAAAAAADnRva2VuX2RlY2ltYWxzAAAAAAAEAAAAAAAAAApzdGFydF90aW1lAAAAAAAGAAAAAQAAAAY=",
        "AAAAAAAAAGlSZWZ1bmQgZXhjZXNzIGJhbGFuY2UgZnJvbSBhIHN0cmVhbSBiYWNrIHRvIHRoZSBzZW5kZXIuCgpTZW5kZXItb25seS4gT25seSB1bm93ZWQgdG9rZW5zIGNhbiBiZSByZWZ1bmRlZC4AAAAAAAAGcmVmdW5kAAAAAAADAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAZzZW5kZXIAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAI5EZXBvc2l0IHRva2VucyBpbnRvIGFuIGV4aXN0aW5nIHN0cmVhbS4KCkFueW9uZSBjYW4gZnVuZCBhIHN0cmVhbSwgYnV0IGBmdW5kZXIucmVxdWlyZV9hdXRoKClgIGlzIG5lZWRlZApmb3IgdGhlIHRva2VuIHRyYW5zZmVyIGF1dGhvcml6YXRpb24uAAAAAAAHZGVwb3NpdAAAAAADAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAZmdW5kZXIAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAGBSZXN0YXJ0IGEgcGF1c2VkIHN0cmVhbSB3aXRoIGEgbmV3IHJhdGUuCgpTZW5kZXItb25seS4gVGhlIHN0cmVhbSBtdXN0IGJlIHBhdXNlZCBhbmQgbm90IHZvaWRlZC4AAAAHcmVzdGFydAAAAAADAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAZzZW5kZXIAAAAAABMAAAAAAAAAD3JhdGVfcGVyX3NlY29uZAAAAAALAAAAAA==",
        "AAAAAAAAAOdFbWVyZ2VuY3kgdXBncmFkZSDigJQgYnlwYXNzZXMgdGltZWxvY2suIFVzZSBvbmx5IGluIGNyaXRpY2FsIHNpdHVhdGlvbnMuCkVtaXRzIGFuIHVwZ3JhZGUgZXZlbnQgZm9yIGF1ZGl0aW5nLgoKQWRtaW4tb25seS4gQ29uc2lkZXIgcmVtb3ZpbmcgdGhpcyBmdW5jdGlvbiBhZnRlciBpbml0aWFsIG1haW5uZXQKc3RhYmlsaXphdGlvbiwgb3IgcmVxdWlyaW5nIGEgc2VwYXJhdGUgZW1lcmdlbmN5IGtleS4AAAAAB3VwZ3JhZGUAAAAAAQAAAAAAAAANbmV3X3dhc21faGFzaAAAAAAAA+4AAAAgAAAAAA==",
        "AAAAAAAAAKpXaXRoZHJhdyBhY2NydWVkIHRva2VucyBmcm9tIGEgc3RyZWFtLgoKT25seSB0aGUgc3RyZWFtIHJlY2lwaWVudCBjYW4gd2l0aGRyYXcuIFRoZSB3aXRoZHJhd24gYW1vdW50IGlzCmNhcHBlZCBhdCB0aGUgY292ZXJlZCBkZWJ0IChiYWxhbmNlLWJhY2tlZCBwb3J0aW9uIG9mIHRvdGFsIGRlYnQpLgAAAAAACHdpdGhkcmF3AAAABAAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAIJEaXJlY3QgYWRtaW4gdHJhbnNmZXIgKGxlZ2FjeSwga2VwdCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkpLgoKQWRtaW4tb25seS4gUHJlZmVyIGBwcm9wb3NlX2FkbWluYCArIGBhY2NlcHRfYWRtaW5gIGZvciBzYWZldHkuAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAACBHZXQgdGhlIHN0cmVhbSdzIGN1cnJlbnQgc3RhdHVzLgAAAAlzdGF0dXNfb2YAAAAAAAABAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAQAAB9AAAAAMU3RyZWFtU3RhdHVz",
        "AAAAAAAAABtHZXQgdGhlIGZ1bGwgc3RyZWFtIHJlY29yZC4AAAAACmdldF9zdHJlYW0AAAAAAAEAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAABAAAH0AAAAApGbG93U3RyZWFtAAA=",
        "AAAAAAAAAMVJbml0aWFsaXplIHRoZSBjb250cmFjdCB3aXRoIGFuIGFkbWluIGFkZHJlc3MuCgpNdXN0IGJlIGNhbGxlZCBleGFjdGx5IG9uY2UgYmVmb3JlIGFueSBvdGhlciBmdW5jdGlvbi4KVGhlIGludGVuZGVkIGFkbWluIG11c3QgYXV0aG9yaXplIHRoZSBpbml0aWFsaXphdGlvbiB0byBwcmV2ZW50CmZpcnN0LWNhbGxlciB0YWtlb3ZlciBhdHRhY2tzLgAAAAAAAAppbml0aWFsaXplAAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAAFBSZWZ1bmQgdGhlIG1heGltdW0gcmVmdW5kYWJsZSBhbW91bnQuCgpTZW5kZXItb25seS4gUmV0dXJucyB0aGUgYW1vdW50IHJlZnVuZGVkLgAAAApyZWZ1bmRfbWF4AAAAAAACAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAZzZW5kZXIAAAAAABMAAAABAAAACw==",
        "AAAAAAAAAHhBZGp1c3QgdGhlIHJhdGUgcGVyIHNlY29uZCBvZiBhbiBhY3RpdmUgc3RyZWFtLgoKU2VuZGVyLW9ubHkuIFRoZSBzdHJlYW0gbXVzdCBiZSBhY3RpdmVseSBzdHJlYW1pbmcgKG5vdCBwYXVzZWQvdm9pZGVkKS4AAAALYWRqdXN0X3JhdGUAAAAAAwAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAhuZXdfcmF0ZQAAAAsAAAAA",
        "AAAAAAAAACFHZXQgdGhlIHN0cmVhbSdzIGN1cnJlbnQgYmFsYW5jZS4AAAAAAAALZ2V0X2JhbGFuY2UAAAAAAQAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAEAAAAL",
        "AAAAAAAAAIRQZXJtYW5lbnRseSB2b2lkIGEgc3RyZWFtLgoKQ2FsbGFibGUgYnkgc2VuZGVyIE9SIHJlY2lwaWVudC4gV3JpdGVzIG9mZiB1bmNvdmVyZWQgZGVidCBhbmQKcHJldmVudHMgdGhlIHN0cmVhbSBmcm9tIGJlaW5nIHJlc3RhcnRlZC4AAAALdm9pZF9zdHJlYW0AAAAAAgAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAH1BY2NlcHQgYW4gYWRtaW4gdHJhbnNmZXIgKHR3by1zdGVwIHRyYW5zZmVyLCBzdGVwIDIpLgoKTXVzdCBiZSBjYWxsZWQgYnkgdGhlIGFkZHJlc3MgdGhhdCB3YXMgcHJvcG9zZWQgdmlhIGBwcm9wb3NlX2FkbWluKClgLgAAAAAAAAxhY2NlcHRfYWRtaW4AAAAAAAAAAA==",
        "AAAAAAAAAHFXaXRoZHJhdyB0aGUgbWF4aW11bSBhdmFpbGFibGUgYW1vdW50IGZyb20gYSBzdHJlYW0uCgpDb252ZW5pZW5jZSBmdW5jdGlvbiDigJQgd2l0aGRyYXdzIHRoZSBlbnRpcmUgY292ZXJlZCBkZWJ0LgAAAAAAAAx3aXRoZHJhd19tYXgAAAADAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAIVQcm9wb3NlIGEgbmV3IGFkbWluICh0d28tc3RlcCB0cmFuc2Zlciwgc3RlcCAxKS4KClRoZSBwcm9wb3NlZCBhZG1pbiBtdXN0IGNhbGwgYGFjY2VwdF9hZG1pbigpYCB0byBjb21wbGV0ZSB0aGUgdHJhbnNmZXIuCkFkbWluLW9ubHkuAAAAAAAADXByb3Bvc2VfYWRtaW4AAAAAAAABAAAAAAAAAAluZXdfYWRtaW4AAAAAAAATAAAAAA==",
        "AAAAAAAAAC1HZXQgdGhlIHRvdGFsIGRlYnQgb3dlZCAobWF5IGV4Y2VlZCBiYWxhbmNlKS4AAAAAAAANdG90YWxfZGVidF9vZgAAAAAAAAEAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAABAAAACw==",
        "AAAAAAAAAC5HZXQgdGhlIGNvdmVyZWQgZGVidCAoZGVidCBiYWNrZWQgYnkgYmFsYW5jZSkuAAAAAAAPY292ZXJlZF9kZWJ0X29mAAAAAAEAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAABAAAACw==",
        "AAAAAAAAAFJFeGVjdXRlIGEgcHJldmlvdXNseSBwcm9wb3NlZCB1cGdyYWRlIGFmdGVyIHRoZSB0aW1lbG9jayBoYXMgZXhwaXJlZC4KCkFkbWluLW9ubHkuAAAAAAAPZXhlY3V0ZV91cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAHJQcm9wb3NlIGEgdGltZWxvY2tlZCB1cGdyYWRlLiBUaGUgdXBncmFkZSBjYW4gYmUgZXhlY3V0ZWQgYWZ0ZXIKVVBHUkFERV9USU1FTE9DS19MRURHRVJTIGhhdmUgcGFzc2VkLgoKQWRtaW4tb25seS4AAAAAAA9wcm9wb3NlX3VwZ3JhZGUAAAAAAQAAAAAAAAANbmV3X3dhc21faGFzaAAAAAAAA+4AAAAgAAAAAA==",
        "AAAAAAAAADxHZXQgdGhlIHRpbWUgYXQgd2hpY2ggdGhlIHN0cmVhbSdzIGJhbGFuY2Ugd2lsbCBiZSBkZXBsZXRlZC4AAAARZGVwbGV0aW9uX3RpbWVfb2YAAAAAAAABAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAQAAAAY=",
        "AAAAAAAAAIVFeHRlbmQgdGhlIFRUTCBvZiBhIHNwZWNpZmljIHN0cmVhbSByZWNvcmQuCgpBbnlvbmUgY2FuIGNhbGwgdGhpcyB0byBrZWVwIGEgbG9uZy1kdXJhdGlvbiBzdHJlYW0gYWxpdmUuCkRvZXMgbm90IG1vZGlmeSBzdHJlYW0gc3RhdGUuAAAAAAAAEWV4dGVuZF9zdHJlYW1fdHRsAAAAAAAAAQAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAA=",
        "AAAAAAAAADBHZXQgdGhlIHVuY292ZXJlZCBkZWJ0IChkZWJ0IGV4Y2VlZGluZyBiYWxhbmNlKS4AAAARdW5jb3ZlcmVkX2RlYnRfb2YAAAAAAAABAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAQAAAAs=",
        "AAAAAAAAAHJDcmVhdGUgYSBuZXcgRmxvdyBzdHJlYW0gYW5kIGltbWVkaWF0ZWx5IGRlcG9zaXQgdG9rZW5zLgoKQ29udmVuaWVuY2UgZnVuY3Rpb24gY29tYmluaW5nIGBjcmVhdGUoKWAgKyBgZGVwb3NpdCgpYC4AAAAAABJjcmVhdGVfYW5kX2RlcG9zaXQAAAAAAAcAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAA9yYXRlX3Blcl9zZWNvbmQAAAAACwAAAAAAAAAOdG9rZW5fZGVjaW1hbHMAAAAAAAQAAAAAAAAACnN0YXJ0X3RpbWUAAAAAAAYAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAAG",
        "AAAAAAAAACFHZXQgdGhlIHN0cmVhbSdzIHJhdGUgcGVyIHNlY29uZC4AAAAAAAATZ2V0X3JhdGVfcGVyX3NlY29uZAAAAAABAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAQAAAAs=",
        "AAAAAAAAADRHZXQgdGhlIHJlZnVuZGFibGUgYW1vdW50IChleGNlc3MgYmFsYW5jZSBub3Qgb3dlZCkuAAAAFHJlZnVuZGFibGVfYW1vdW50X29mAAAAAQAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAEAAAAL",
        "AAAAAAAAAC1HZXQgdGhlIGFtb3VudCB3aXRoZHJhd2FibGUgYnkgdGhlIHJlY2lwaWVudC4AAAAAAAAWd2l0aGRyYXdhYmxlX2Ftb3VudF9vZgAAAAAAAQAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAEAAAAL",
        "AAAAAQAAA3pDb3JlIGRhdGEgc3RydWN0dXJlIGZvciBhIEZsb3cgKG9wZW4tZW5kZWQsIHJhdGUtcGVyLXNlY29uZCkgc3RyZWFtLgoKUG9ydGVkIGZyb20gU2FibGllcidzIGBGbG93LlN0cmVhbWAgc3RydWN0IHdpdGggdGhlc2UgYWRhcHRhdGlvbnM6CgotIGBVRDIxeDE4IHJhdGVQZXJTZWNvbmRgIOKGkiBgaTEyOCByYXRlX3Blcl9zZWNvbmRgIHNjYWxlZCB0byAxOCBkZWNpbWFscy4KU29yb2JhbiBoYXMgbm8gbmF0aXZlIGZpeGVkLXBvaW50IHR5cGUsIHNvIHdlIHVzZSBpMTI4IHdpdGggbWFudWFsIHNjYWxpbmcuCkEgcmF0ZSBvZiAxIHRva2VuL3NlYyBmb3IgYSA3LWRlY2ltYWwgdG9rZW4gPSAxZTE4IGludGVybmFsbHkuCgotIGBJRVJDMjAgdG9rZW5gIOKGkiBgQWRkcmVzc2AgKFNvcm9iYW4gdG9rZW4gY29udHJhY3QgYWRkcmVzcykuCgotIGB1aW50MTI4IGJhbGFuY2VgIOKGkiBgaTEyOGAgKFNvcm9iYW4gU0RLIGNvbnZlbnRpb24gZm9yIHRva2VuIGFtb3VudHMpLgoKLSBgdWludDQwIHNuYXBzaG90VGltZWAg4oaSIGB1NjRgIChTb3JvYmFuIGxlZGdlciB0aW1lc3RhbXAgaXMgdTY0KS4KCi0gYGJvb2wgaXNTdHJlYW1gIHNlbnRpbmVsIHJlbW92ZWQg4oCUIHdlIHVzZSBzdG9yYWdlIGtleSBleGlzdGVuY2UgaW5zdGVhZC4KCi0gYGJvb2wgaXNUcmFuc2ZlcmFibGVgIHJlbW92ZWQg4oCUIGRlbGVnYXRlZCB0byB0aGUgTkZUIGNvbnRyYWN0IGxheWVyLgoKIyBTdG9yYWdlIExheW91dAoKRWFjaCBzdHJlYW0gaXMgc3RvcmVkIHVuZGVyIGBEYXRhS2V5OjpTdHJlYW0oc3RyZWFtX2lkKWAgaW4gcGVyc2lzdGVudCBzdG9yYWdlLgpUaGUgc3RydWN0IGlzIGtlcHQgYXMgZmxhdCBhcyBwb3NzaWJsZSB0byBtaW5pbWl6ZSBzZXJpYWxpemF0aW9uIG92ZXJoZWFkLgAAAAAAAAAAAApGbG93U3RyZWFtAAAAAAAJAAAATkN1cnJlbnQgYmFsYW5jZSBoZWxkIGluIHRoZSBzdHJlYW0gKGRlcG9zaXRlZCAtIHdpdGhkcmF3biksIGluIHRva2VuIGRlY2ltYWxzLgAAAAAAB2JhbGFuY2UAAAAACwAAAC9XaGV0aGVyIHRoZSBzdHJlYW0gaGFzIGJlZW4gcGVybWFuZW50bHkgdm9pZGVkLgAAAAAJaXNfdm9pZGVkAAAAAAAAAQAAAKVSYXRlIGF0IHdoaWNoIGRlYnQgYWNjcnVlcywgaW4gMTgtZGVjaW1hbCBmaXhlZC1wb2ludC4KMCBtZWFucyB0aGUgc3RyZWFtIGlzIHBhdXNlZC4KRXhhbXBsZTogMSB0b2tlbi9zZWMgZm9yIGEgNy1kZWNpbWFsIHRva2VuIOKGkiAxXzAwMF8wMDBfMDAwXzAwMF8wMDBfMDAwICgxZTE4KS4AAAAAAAAPcmF0ZV9wZXJfc2Vjb25kAAAAAAsAAAAwVGhlIGFkZHJlc3MgcmVjZWl2aW5nIHRoZSB0b2tlbnMgKGNhbiB3aXRoZHJhdykuAAAACXJlY2lwaWVudAAAAAAAABMAAAA9VGhlIGFkZHJlc3Mgc3RyZWFtaW5nIHRoZSB0b2tlbnMgKGNhbiBwYXVzZSwgYWRqdXN0LCByZWZ1bmQpLgAAAAAAAAZzZW5kZXIAAAAAABMAAAB6QWNjdW11bGF0ZWQgZGVidCBhdCB0aGUgbGFzdCBzbmFwc2hvdCwgaW4gMTgtZGVjaW1hbCBmaXhlZC1wb2ludC4KVG90YWwgZGVidCA9IHNuYXBzaG90X2RlYnRfc2NhbGVkICsgb25nb2luZ19kZWJ0X3NjYWxlZC4AAAAAABRzbmFwc2hvdF9kZWJ0X3NjYWxlZAAAAAsAAABkVW5peCB0aW1lc3RhbXAgb2YgdGhlIGxhc3QgZGVidCBzbmFwc2hvdC4KRGVidCBhY2NydWVzIGZyb20gdGhpcyBwb2ludCBmb3J3YXJkIGF0IGByYXRlX3Blcl9zZWNvbmRgLgAAAA1zbmFwc2hvdF90aW1lAAAAAAAABgAAADpUaGUgU29yb2JhbiB0b2tlbiBjb250cmFjdCBhZGRyZXNzIChTQUMgb3IgY3VzdG9tIFNFUC00MSkuAAAAAAAFdG9rZW4AAAAAAAATAAAAbU51bWJlciBvZiBkZWNpbWFscyBmb3IgdGhlIHRva2VuIChlLmcuIDcgZm9yIG1vc3QgU3RlbGxhciBhc3NldHMpLgpVc2VkIGZvciBzY2FsZS9kZXNjYWxlIG9wZXJhdGlvbnMuIE1heCAxOC4AAAAAAAAOdG9rZW5fZGVjaW1hbHMAAAAAAAQ=",
        "AAAAAwAAAGhUeXBlIG9mIHN0cmVhbSAoRmxvdyBvciBMb2NrdXApLgpVc2VkIGJ5IHRoZSBTdHJlYW0gTkZUIGFuZCBSb3V0ZXIgdG8gcm91dGUgbG9naWMgdG8gdGhlIGNvcnJlY3QgZW5naW5lLgAAAAAAAAAKU3RyZWFtVHlwZQAAAAAAAgAAAAAAAAAERmxvdwAAAAAAAAAAAAAABkxvY2t1cAAAAAAAAQ==",
        "AAAAAwAAAMtTdGF0dXMgb2YgYSBMb2NrdXAgc3RyZWFtLgoKVXNlcyAidGVtcGVyYXR1cmUiIHNlbWFudGljczoKLSAqKldhcm0qKiAoUGVuZGluZywgU3RyZWFtaW5nKTogdGltZSBhbG9uZSBjYW4gY2hhbmdlIHRoZSBzdGF0dXMuCi0gKipDb2xkKiogKFNldHRsZWQsIENhbmNlbGVkLCBEZXBsZXRlZCk6IHRpbWUgYWxvbmUgY2Fubm90IGNoYW5nZSB0aGUgc3RhdHVzLgAAAAAAAAAADExvY2t1cFN0YXR1cwAAAAUAAAA/Q3JlYXRlZCBidXQgc3RhcnRfdGltZSBpcyBpbiB0aGUgZnV0dXJlLiBObyB0b2tlbnMgaGF2ZSB2ZXN0ZWQuAAAAAAdQZW5kaW5nAAAAAAAAAAAyQWN0aXZlIOKAlCB0b2tlbnMgYXJlIGN1cnJlbnRseSB2ZXN0aW5nIG92ZXIgdGltZS4AAAAAAAlTdHJlYW1pbmcAAAAAAAABAAAAS0FsbCB0b2tlbnMgaGF2ZSBmdWxseSB2ZXN0ZWQuIFJlY2lwaWVudCBjYW4gd2l0aGRyYXcgdGhlIHJlbWFpbmluZyBiYWxhbmNlLgAAAAAHU2V0dGxlZAAAAAACAAAAP1NlbmRlciBjYW5jZWxlZCB0aGUgc3RyZWFtLiBVbnZlc3RlZCB0b2tlbnMgcmV0dXJuZWQgdG8gc2VuZGVyLgAAAAAIQ2FuY2VsZWQAAAADAAAAQkZ1bGx5IHdpdGhkcmF3biAoYW5kL29yIHJlZnVuZGVkKS4gTm8gdG9rZW5zIHJlbWFpbiBpbiB0aGUgc3RyZWFtLgAAAAAACERlcGxldGVkAAAABA==",
        "AAAAAQAAAtxDb3JlIGRhdGEgc3RydWN0dXJlIGZvciBhIExvY2t1cCAoZml4ZWQtdGVybSB2ZXN0aW5nKSBzdHJlYW0uCgpTdXBwb3J0cyBsaW5lYXIgdW5sb2NrIHdpdGggb3B0aW9uYWwgY2xpZmYuIFRoZSB2ZXN0ZWQgKCJzdHJlYW1lZCIpIGFtb3VudAphdCBhbnkgdGltZSBgdGAgaXMgY2FsY3VsYXRlZCBhczoKCmBgYHRleHQKaWYgdCA8IHN0YXJ0X3RpbWU6ICAgICAgIHZlc3RlZCA9IDAKaWYgdCA8IGNsaWZmX3RpbWU6ICAgICAgIHZlc3RlZCA9IHN0YXJ0X3VubG9ja19hbW91bnQKaWYgdCA+PSBlbmRfdGltZTogICAgICAgICB2ZXN0ZWQgPSB0b3RhbF9hbW91bnQKZWxzZToKZWxhcHNlZCA9IGZsb29yKCh0IC0gY2xpZmZfdGltZSkgLyBncmFudWxhcml0eSkgKiBncmFudWxhcml0eQpzdHJlYW1hYmxlX2R1cmF0aW9uID0gZW5kX3RpbWUgLSBjbGlmZl90aW1lCnN0cmVhbWFibGVfYW1vdW50ID0gdG90YWxfYW1vdW50IC0gc3RhcnRfdW5sb2NrX2Ftb3VudCAtIGNsaWZmX3VubG9ja19hbW91bnQKdmVzdGVkID0gc3RhcnRfdW5sb2NrX2Ftb3VudCArIGNsaWZmX3VubG9ja19hbW91bnQgKyAoZWxhcHNlZCAqIHN0cmVhbWFibGVfYW1vdW50IC8gc3RyZWFtYWJsZV9kdXJhdGlvbikKYGBgCgpUaGlzIG1pcnJvcnMgdGhlIHJlZmVyZW5jZSBsaW5lYXIgbG9ja3VwIGNhbGN1bGF0aW9uIHdpdGggZGlzY3JldGUgdW5sb2NrCnN0ZXBzIGF0IGBncmFudWxhcml0eWAtc2Vjb25kIGludGVydmFscy4AAAAAAAAADExvY2t1cFN0cmVhbQAAAA8AAABGV2hldGhlciB0aGUgc2VuZGVyIGNhbiBjYW5jZWwgdGhpcyBzdHJlYW0gYW5kIHJlY2xhaW0gdW52ZXN0ZWQgdG9rZW5zLgAAAAAACmNhbmNlbGFibGUAAAAAAAEAAABuT3B0aW9uYWwgY2xpZmYgdGltZXN0YW1wLiBObyB0b2tlbnMgYmV5b25kIGBzdGFydF91bmxvY2tfYW1vdW50YAp2ZXN0IGJlZm9yZSB0aGlzIHRpbWUuIFNldCB0byAwIGZvciBubyBjbGlmZi4AAAAAAApjbGlmZl90aW1lAAAAAAAGAAAAR0Ftb3VudCB1bmxvY2tlZCBhdCBgY2xpZmZfdGltZWAgKGluIGFkZGl0aW9uIHRvIGBzdGFydF91bmxvY2tfYW1vdW50YCkuAAAAABNjbGlmZl91bmxvY2tfYW1vdW50AAAAAAsAAAAxVW5peCB0aW1lc3RhbXAgd2hlbiB0aGUgbG9ja3VwIGlzIGZ1bGx5IHVubG9ja2VkLgAAAAAAAAhlbmRfdGltZQAAAAYAAAB9VW5sb2NrIGdyYW51bGFyaXR5IGluIHNlY29uZHMuIFRva2VucyB2ZXN0IGluIGRpc2NyZXRlIHN0ZXBzIG9mIHRoaXMKaW50ZXJ2YWwuIERlZmF1bHQgPSAxIChwZXItc2Vjb25kIHZlc3RpbmcpLiBNdXN0IGJlID4gMC4AAAAAAAALZ3JhbnVsYXJpdHkAAAAABgAAADdXaGV0aGVyIGFsbCB0b2tlbnMgaGF2ZSBiZWVuIHdpdGhkcmF3biBhbmQvb3IgcmVmdW5kZWQuAAAAAAtpc19kZXBsZXRlZAAAAAABAAAAP1RoZSBhZGRyZXNzIHRoYXQgcmVjZWl2ZXMgdG9rZW5zIGFzIHRoZXkgdW5sb2NrIChjYW4gd2l0aGRyYXcpLgAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAEFBbW91bnQgcmVmdW5kZWQgdG8gc2VuZGVyIG9uIGNhbmNlbGxhdGlvbi4gWmVybyB1bmxlc3MgY2FuY2VsbGVkLgAAAAAAAA9yZWZ1bmRlZF9hbW91bnQAAAAACwAAAExUaGUgYWRkcmVzcyB0aGF0IGNyZWF0ZWQgYW5kIGZ1bmRlZCB0aGUgbG9ja3VwIChjYW4gY2FuY2VsIGlmIGBjYW5jZWxhYmxlYCkuAAAABnNlbmRlcgAAAAAAEwAAACZVbml4IHRpbWVzdGFtcCB3aGVuIHRoZSBsb2NrdXAgYmVnaW5zLgAAAAAACnN0YXJ0X3RpbWUAAAAAAAYAAAAsQW1vdW50IHVubG9ja2VkIGltbWVkaWF0ZWx5IGF0IGBzdGFydF90aW1lYC4AAAATc3RhcnRfdW5sb2NrX2Ftb3VudAAAAAALAAAAI1RoZSBTb3JvYmFuIHRva2VuIGNvbnRyYWN0IGFkZHJlc3MuAAAAAAV0b2tlbgAAAAAAABMAAAA7VG90YWwgYW1vdW50IGRlcG9zaXRlZCBpbnRvIHRoZSBzdHJlYW0gKGluIHRva2VuIGRlY2ltYWxzKS4AAAAADHRvdGFsX2Ftb3VudAAAAAsAAAAmV2hldGhlciB0aGUgc3RyZWFtIGhhcyBiZWVuIGNhbmNlbGxlZC4AAAAAAAx3YXNfY2FuY2VsZWQAAAABAAAALUN1bXVsYXRpdmUgYW1vdW50IHdpdGhkcmF3biBieSB0aGUgcmVjaXBpZW50LgAAAAAAABB3aXRoZHJhd25fYW1vdW50AAAACw==",
        "AAAAAwAAALFTdGF0dXMgb2YgYSBGbG93IHN0cmVhbS4KClRoZSBzdGF0dXMgaXMgZGVyaXZlZCBmcm9tIHRoZSBzdHJlYW0ncyBjdXJyZW50IHN0YXRlIChyYXRlLCBiYWxhbmNlLCBkZWJ0LCB2b2lkZWQgZmxhZykgcmF0aGVyIHRoYW4KYmVpbmcgc3RvcmVkIGRpcmVjdGx5IOKAlCBrZWVwaW5nIHN0b3JhZ2UgbWluaW1hbC4AAAAAAAAAAAAADFN0cmVhbVN0YXR1cwAAAAYAAAA+U3RyZWFtIHNjaGVkdWxlZCB0byBzdGFydCBpbiB0aGUgZnV0dXJlIChzbmFwc2hvdF90aW1lID4gbm93KS4AAAAAAAdQZW5kaW5nAAAAAAAAAAAyQWN0aXZlbHkgc3RyZWFtaW5nIHdpdGggYmFsYW5jZSBjb3ZlcmluZyBhbGwgZGVidC4AAAAAABBTdHJlYW1pbmdTb2x2ZW50AAAAAQAAADZBY3RpdmVseSBzdHJlYW1pbmcgYnV0IGRlYnQgZXhjZWVkcyBhdmFpbGFibGUgYmFsYW5jZS4AAAAAABJTdHJlYW1pbmdJbnNvbHZlbnQAAAAAAAIAAAAoUGF1c2VkIGJ5IHNlbmRlciB3aXRoIG5vIHVuY292ZXJlZCBkZWJ0LgAAAA1QYXVzZWRTb2x2ZW50AAAAAAAAAwAAACVQYXVzZWQgYnkgc2VuZGVyIHdpdGggdW5jb3ZlcmVkIGRlYnQuAAAAAAAAD1BhdXNlZEluc29sdmVudAAAAAAEAAAARVBlcm1hbmVudGx5IHN0b3BwZWQuIENhbm5vdCBiZSByZXN0YXJ0ZWQuIFVuY292ZXJlZCBkZWJ0IHdyaXR0ZW4gb2ZmLgAAAAAAAAZWb2lkZWQAAAAAAAU=",
        "AAAAAQAAAINQYXJhbWV0ZXJzIGZvciBjcmVhdGluZyBhIG5ldyBMb2NrdXAgc3RyZWFtLgoKQnVuZGxlZCBpbnRvIGEgc3RydWN0IGJlY2F1c2UgU29yb2JhbiBjb250cmFjdCBmdW5jdGlvbnMKaGF2ZSBhIG1heCBvZiAxMCBwYXJhbWV0ZXJzLgAAAAAAAAAAEkNyZWF0ZUxvY2t1cFBhcmFtcwAAAAAACwAAAClXaGV0aGVyIHRoZSBzZW5kZXIgY2FuIGNhbmNlbCB0aGUgc3RyZWFtLgAAAAAAAApjYW5jZWxhYmxlAAAAAAABAAAAME9wdGlvbmFsIGNsaWZmIHRpbWVzdGFtcC4gU2V0IHRvIDAgZm9yIG5vIGNsaWZmLgAAAApjbGlmZl90aW1lAAAAAAAGAAAAKlRva2VucyB1bmxvY2tlZCBhdCBjbGlmZiAoYWRkZWQgdG8gc3RhcnQpLgAAAAAAE2NsaWZmX3VubG9ja19hbW91bnQAAAAACwAAACZVbml4IHRpbWVzdGFtcCB3aGVuIHZlc3RpbmcgY29tcGxldGVzLgAAAAAACGVuZF90aW1lAAAABgAAADFVbmxvY2sgc3RlcCBpbnRlcnZhbCBpbiBzZWNvbmRzLiAwIGRlZmF1bHRzIHRvIDEuAAAAAAAAC2dyYW51bGFyaXR5AAAAAAYAAAAgQWRkcmVzcyByZWNlaXZpbmcgdmVzdGVkIHRva2Vucy4AAAAJcmVjaXBpZW50AAAAAAAAEwAAADhBZGRyZXNzIGZ1bmRpbmcgdGhlIHN0cmVhbSAoY2FuIGNhbmNlbCBpZiBgY2FuY2VsYWJsZWApLgAAAAZzZW5kZXIAAAAAABMAAAAjVW5peCB0aW1lc3RhbXAgd2hlbiB2ZXN0aW5nIGJlZ2lucy4AAAAACnN0YXJ0X3RpbWUAAAAAAAYAAAAlVG9rZW5zIHVubG9ja2VkIGltbWVkaWF0ZWx5IGF0IHN0YXJ0LgAAAAAAABNzdGFydF91bmxvY2tfYW1vdW50AAAAAAsAAAAfU29yb2JhbiB0b2tlbiBjb250cmFjdCBhZGRyZXNzLgAAAAAFdG9rZW4AAAAAAAATAAAAKVRvdGFsIHRva2VucyB0byB2ZXN0IChpbiB0b2tlbiBkZWNpbWFscykuAAAAAAAADHRvdGFsX2Ftb3VudAAAAAs=",
        "AAAABAAAACtFcnJvcnMgc3BlY2lmaWMgdG8gdGhlIFN0cmVhbSBORlQgY29udHJhY3QuAAAAAAAAAAAITmZ0RXJyb3IAAAAFAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAMkAAAAAAAAADU5vdEF1dGhvcml6ZWQAAAAAAADKAAAAAAAAAA1Ub2tlbk5vdEZvdW5kAAAAAAAAywAAAAAAAAAPTm90VHJhbnNmZXJhYmxlAAAAAMwAAAAhVG9rZW4gSUQgaGFzIGFscmVhZHkgYmVlbiBtaW50ZWQuAAAAAAAADUFscmVhZHlNaW50ZWQAAAAAAADN",
        "AAAABAAAAC5FcnJvcnMgZW1pdHRlZCBieSB0aGUgRmxvdyBzdHJlYW1pbmcgY29udHJhY3QuAAAAAAAAAAAACUZsb3dFcnJvcgAAAAAAABwAAAAZU3RyZWFtIElEIGRvZXMgbm90IGV4aXN0LgAAAAAAAA5TdHJlYW1Ob3RGb3VuZAAAAAAAAQAAACxDYWxsZXIgaXMgbm90IGF1dGhvcml6ZWQgZm9yIHRoaXMgb3BlcmF0aW9uLgAAAAxVbmF1dGhvcml6ZWQAAAACAAAANlN0cmVhbSBpcyBwYXVzZWQ7IG9wZXJhdGlvbiByZXF1aXJlcyBhY3RpdmUgc3RyZWFtaW5nLgAAAAAADFN0cmVhbVBhdXNlZAAAAAMAAAAvU3RyZWFtIGlzIHZvaWRlZDsgbm8gZnVydGhlciBtdXRhdGlvbnMgYWxsb3dlZC4AAAAADFN0cmVhbVZvaWRlZAAAAAQAAAA3U3RyZWFtIGlzIG5vdCBwYXVzZWQ7IHJlc3RhcnQgcmVxdWlyZXMgYSBwYXVzZWQgc3RyZWFtLgAAAAAPU3RyZWFtTm90UGF1c2VkAAAAAAUAAAA5U3RyZWFtIGhhcyBub3Qgc3RhcnRlZCB5ZXQgKHNuYXBzaG90X3RpbWUgaW4gdGhlIGZ1dHVyZSkuAAAAAAAADVN0cmVhbVBlbmRpbmcAAAAAAAAGAAAAIE5ldyByYXRlIHBlciBzZWNvbmQgbXVzdCBiZSA+IDAuAAAAEVJhdGVQZXJTZWNvbmRaZXJvAAAAAAAABwAAACdOZXcgcmF0ZSBtdXN0IGRpZmZlciBmcm9tIGN1cnJlbnQgcmF0ZS4AAAAAEFJhdGVOb3REaWZmZXJlbnQAAAAIAAAAG0RlcG9zaXQgYW1vdW50IG11c3QgYmUgPiAwLgAAAAARRGVwb3NpdEFtb3VudFplcm8AAAAAAAAJAAAAHFdpdGhkcmF3IGFtb3VudCBtdXN0IGJlID4gMC4AAAASV2l0aGRyYXdBbW91bnRaZXJvAAAAAAAKAAAALVdpdGhkcmF3IGFtb3VudCBleGNlZWRzIHdpdGhkcmF3YWJsZSBiYWxhbmNlLgAAAAAAAAhPdmVyZHJhdwAAAAsAAAAaUmVmdW5kIGFtb3VudCBtdXN0IGJlID4gMC4AAAAAABBSZWZ1bmRBbW91bnRaZXJvAAAADAAAAClSZWZ1bmQgYW1vdW50IGV4Y2VlZHMgcmVmdW5kYWJsZSBiYWxhbmNlLgAAAAAAAA5SZWZ1bmRPdmVyZmxvdwAAAAAADQAAACVUb2tlbiBoYXMgPiAxOCBkZWNpbWFscywgdW5zdXBwb3J0ZWQuAAAAAAAAFEludmFsaWRUb2tlbkRlY2ltYWxzAAAADgAAADZTdHJlYW0gYmFsYW5jZSBpcyB6ZXJvIChlLmcuIHF1ZXJ5aW5nIGRlcGxldGlvbiB0aW1lKS4AAAAAAAtCYWxhbmNlWmVybwAAAAAPAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGl6ZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAEAAAAB1Db250cmFjdCBub3QgeWV0IGluaXRpYWxpemVkLgAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAEQAAADhDYW5ub3QgY3JlYXRlIGEgcGVuZGluZyBzdHJlYW0gd2l0aCByYXRlX3Blcl9zZWNvbmQgPSAwLgAAABdDcmVhdGVSYXRlUGVyU2Vjb25kWmVybwAAAAASAAAAOUludGVybmFsIG1hdGggZXJyb3Ig4oCUIHNob3VsZCBuZXZlciBvY2N1ciBpbiBwcm9kdWN0aW9uLgAAAAAAABJJbnZhbGlkQ2FsY3VsYXRpb24AAAAAABMAAAAxU2VuZGVyIGFuZCByZWNpcGllbnQgbXVzdCBiZSBkaWZmZXJlbnQgYWRkcmVzc2VzLgAAAAAAABVTZW5kZXJFcXVhbHNSZWNpcGllbnQAAAAAAAAUAAAAJVJhdGUgcGVyIHNlY29uZCBtdXN0IG5vdCBiZSBuZWdhdGl2ZS4AAAAAAAAMTmVnYXRpdmVSYXRlAAAAFQAAAEVUb2tlbiB0cmFuc2ZlciByZXN1bHRlZCBpbiBhIGRpZmZlcmVudCBiYWxhbmNlIGNoYW5nZSB0aGFuIHJlcXVlc3RlZC4AAAAAAAAVVG9rZW5UcmFuc2Zlck1pc21hdGNoAAAAAAAAFgAAAD9DYWxsZXItc3VwcGxpZWQgdG9rZW4gZGVjaW1hbHMgZG8gbm90IG1hdGNoIHRoZSB0b2tlbiBjb250cmFjdC4AAAAAFVRva2VuRGVjaW1hbHNNaXNtYXRjaAAAAAAAABcAAAA5Q2hlY2tlZCBhcml0aG1ldGljIG9wZXJhdGlvbiBmYWlsZWQgKG92ZXJmbG93L3VuZGVyZmxvdykuAAAAAAAAD0FyaXRobWV0aWNFcnJvcgAAAAAYAAAAH0FkbWluIHRyYW5zZmVyIGFscmVhZHkgcGVuZGluZy4AAAAAFEFkbWluVHJhbnNmZXJQZW5kaW5nAAAAGQAAACRObyBhZG1pbiB0cmFuc2ZlciBwZW5kaW5nIHRvIGFjY2VwdC4AAAAWTm9BZG1pblRyYW5zZmVyUGVuZGluZwAAAAAAGgAAADFVcGdyYWRlIGlzIHRpbWVsb2NrZWQgYW5kIGNhbm5vdCBiZSBleGVjdXRlZCB5ZXQuAAAAAAAAEVVwZ3JhZGVUaW1lbG9ja2VkAAAAAAAAGwAAAB1ObyB1cGdyYWRlIGhhcyBiZWVuIHByb3Bvc2VkLgAAAAAAABFOb1VwZ3JhZGVQcm9wb3NlZAAAAAAAABw=",
        "AAAABAAAAC5FcnJvcnMgZW1pdHRlZCBieSB0aGUgTG9ja3VwIHZlc3RpbmcgY29udHJhY3QuAAAAAAAAAAAAC0xvY2t1cEVycm9yAAAAABQAAAAZU3RyZWFtIElEIGRvZXMgbm90IGV4aXN0LgAAAAAAAA5TdHJlYW1Ob3RGb3VuZAAAAAAAZQAAABlDYWxsZXIgaXMgbm90IGF1dGhvcml6ZWQuAAAAAAAADFVuYXV0aG9yaXplZAAAAGYAAAAcU3RyZWFtIGlzIGFscmVhZHkgY2FuY2VsbGVkLgAAABBBbHJlYWR5Q2FuY2VsbGVkAAAAZwAAABlTdHJlYW0gaXMgbm90IGNhbmNlbGFibGUuAAAAAAAADU5vdENhbmNlbGFibGUAAAAAAABoAAAAKVdpdGhkcmF3IGFtb3VudCBleGNlZWRzIHVubG9ja2VkIGJhbGFuY2UuAAAAAAAACE92ZXJkcmF3AAAAaQAAADxJbnZhbGlkIHRpbWUgcGFyYW1ldGVycyAoc3RhcnQgPj0gZW5kLCBjbGlmZiBvdXRzaWRlIHJhbmdlKS4AAAAQSW52YWxpZFRpbWVSYW5nZQAAAGoAAAAZVG90YWwgYW1vdW50IG11c3QgYmUgPiAwLgAAAAAAAApBbW91bnRaZXJvAAAAAABrAAAAHUNvbnRyYWN0IGFscmVhZHkgaW5pdGlhbGl6ZWQuAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAbAAAAB1Db250cmFjdCBub3QgeWV0IGluaXRpYWxpemVkLgAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAbQAAADFTZW5kZXIgYW5kIHJlY2lwaWVudCBtdXN0IGJlIGRpZmZlcmVudCBhZGRyZXNzZXMuAAAAAAAAFVNlbmRlckVxdWFsc1JlY2lwaWVudAAAAAAAAG4AAAA3c3RhcnRfdW5sb2NrX2Ftb3VudCBvciBjbGlmZl91bmxvY2tfYW1vdW50IGlzIG5lZ2F0aXZlLgAAAAAUTmVnYXRpdmVVbmxvY2tBbW91bnQAAABvAAAALkNoZWNrZWQgYWRkaXRpb24gb2YgdW5sb2NrIGFtb3VudHMgb3ZlcmZsb3dlZC4AAAAAABFVbmxvY2tTdW1PdmVyZmxvdwAAAAAAAHAAAAA3VW5sb2NrIHN1bSBpcyBub3QgaW4gdGhlIHZhbGlkIHJhbmdlIFswLCB0b3RhbF9hbW91bnRdLgAAAAAQSW52YWxpZFVubG9ja1N1bQAAAHEAAAAwRGVmZW5zaXZlIGNhbmNlbGxhdGlvbiBhbW91bnQgdmFsaWRhdGlvbiBmYWlsZWQuAAAAGUludmFsaWRDYW5jZWxsYXRpb25BbW91bnQAAAAAAAByAAAARVRva2VuIHRyYW5zZmVyIHJlc3VsdGVkIGluIGEgZGlmZmVyZW50IGJhbGFuY2UgY2hhbmdlIHRoYW4gcmVxdWVzdGVkLgAAAAAAABVUb2tlblRyYW5zZmVyTWlzbWF0Y2gAAAAAAABzAAAAOUNoZWNrZWQgYXJpdGhtZXRpYyBvcGVyYXRpb24gZmFpbGVkIChvdmVyZmxvdy91bmRlcmZsb3cpLgAAAAAAAA9Bcml0aG1ldGljRXJyb3IAAAAAdAAAAB9BZG1pbiB0cmFuc2ZlciBhbHJlYWR5IHBlbmRpbmcuAAAAABRBZG1pblRyYW5zZmVyUGVuZGluZwAAAHUAAAAkTm8gYWRtaW4gdHJhbnNmZXIgcGVuZGluZyB0byBhY2NlcHQuAAAAFk5vQWRtaW5UcmFuc2ZlclBlbmRpbmcAAAAAAHYAAAAxVXBncmFkZSBpcyB0aW1lbG9ja2VkIGFuZCBjYW5ub3QgYmUgZXhlY3V0ZWQgeWV0LgAAAAAAABFVcGdyYWRlVGltZWxvY2tlZAAAAAAAAHcAAAAdTm8gdXBncmFkZSBoYXMgYmVlbiBwcm9wb3NlZC4AAAAAAAARTm9VcGdyYWRlUHJvcG9zZWQAAAAAAAB4",
        "AAAABAAAACdFcnJvcnMgc3BlY2lmaWMgdG8gdGhlIFJvdXRlciBjb250cmFjdC4AAAAAAAAAAAtSb3V0ZXJFcnJvcgAAAAAFAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAS0AAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAEuAAAAAAAAAA1Ob3RBdXRob3JpemVkAAAAAAABLwAAAAAAAAARSW52YWxpZFN0cmVhbVR5cGUAAAAAAAEwAAAANEEgcmVxdWlyZWQgY29udHJhY3QgYWRkcmVzcyBpcyBpbnZhbGlkICh6ZXJvL3Vuc2V0KS4AAAAWSW52YWxpZENvbnRyYWN0QWRkcmVzcwAAAAABMQ==",
        "AAAAAgAAAKFTdG9yYWdlIGtleXMgZm9yIGNvbnRyYWN0IGRhdGEuCgpVc2luZyBhIHR5cGVkIGVudW0gcHJldmVudHMga2V5IGNvbGxpc2lvbnMgKFNLSUxMLm1kIMKnMykuCktleXMgYXJlIG5hbWVzcGFjZWQgYnkgdmFyaWFudCB0byBrZWVwIGRpZmZlcmVudCBkYXRhIHR5cGVzIHNlcGFyYXRlLgAAAAAAAAAAAAAHRGF0YUtleQAAAAAQAAAAAAAAACFBZG1pbiBhZGRyZXNzIChJbnN0YW5jZSBzdG9yYWdlKS4AAAAAAAAFQWRtaW4AAAAAAAAAAAAAKk5leHQgc3RyZWFtIElEIGNvdW50ZXIgKEluc3RhbmNlIHN0b3JhZ2UpLgAAAAAADE5leHRTdHJlYW1JZAAAAAEAAAA+QSBGbG93IHN0cmVhbSByZWNvcmQsIGtleWVkIGJ5IHN0cmVhbSBJRCAoUGVyc2lzdGVudCBzdG9yYWdlKS4AAAAAAApGbG93U3RyZWFtAAAAAAABAAAABgAAAAEAAABAQSBMb2NrdXAgc3RyZWFtIHJlY29yZCwga2V5ZWQgYnkgc3RyZWFtIElEIChQZXJzaXN0ZW50IHN0b3JhZ2UpLgAAAAxMb2NrdXBTdHJlYW0AAAABAAAABgAAAAEAAACTQWdncmVnYXRlIHRva2VuIGJhbGFuY2UgaGVsZCBieSB0aGUgY29udHJhY3QgZm9yIGEgZ2l2ZW4gdG9rZW4gYWRkcmVzcy4KVXNlZCBmb3Igc3VycGx1cyByZWNvdmVyeSAvIGFjY291bnRpbmcgcmVjb25jaWxpYXRpb24gKFBlcnNpc3RlbnQgc3RvcmFnZSkuAAAAABBBZ2dyZWdhdGVCYWxhbmNlAAAAAQAAABMAAAABAAAAOE5GVCB0b2tlbiBvd25lciwga2V5ZWQgYnkgdG9rZW4gSUQgKFBlcnNpc3RlbnQgc3RvcmFnZSkuAAAAClRva2VuT3duZXIAAAAAAAEAAAALAAAAAQAAAExORlQgc3RyZWFtIGRhdGEgbWFwcGluZyB0b2tlbiBJRCB0byBzdHJlYW0gdHlwZSBhbmQgSUQgKFBlcnNpc3RlbnQgc3RvcmFnZSkuAAAAD1Rva2VuU3RyZWFtRGF0YQAAAAABAAAACwAAAAEAAAA4TnVtYmVyIG9mIE5GVHMgb3duZWQgYnkgYW4gYWRkcmVzcyAoUGVyc2lzdGVudCBzdG9yYWdlKS4AAAAKTmZ0QmFsYW5jZQAAAAAAAQAAABMAAAABAAAAO1Rva2VuIG1ldGFkYXRhLCBlLmcuLCBuYW1lLCBzeW1ib2wsIFVSSSAoSW5zdGFuY2Ugc3RvcmFnZSkuAAAAAA1Ub2tlbk1ldGFkYXRhAAAAAAAAAQAAABEAAAAAAAAALFJvdXRlciBjb25maWd1cmF0aW9uOiBGbG93IGNvbnRyYWN0IGFkZHJlc3MuAAAADEZsb3dDb250cmFjdAAAAAAAAAAuUm91dGVyIGNvbmZpZ3VyYXRpb246IExvY2t1cCBjb250cmFjdCBhZGRyZXNzLgAAAAAADkxvY2t1cENvbnRyYWN0AAAAAAAAAAAAK1JvdXRlciBjb25maWd1cmF0aW9uOiBORlQgY29udHJhY3QgYWRkcmVzcy4AAAAAC05mdENvbnRyYWN0AAAAAAAAAAA9UGF5bWFzdGVyIGNvbmZpZ3VyYXRpb246IGxpc3Qgb2YgYWxsb3dlZCBmZWUgdG9rZW4gYWRkcmVzc2VzLgAAAAAAABBBbGxvd2VkRmVlVG9rZW5zAAAAAAAAAEVQZW5kaW5nIGFkbWluIGFkZHJlc3MgZm9yIHR3by1zdGVwIGFkbWluIHRyYW5zZmVyIChJbnN0YW5jZSBzdG9yYWdlKS4AAAAAAAAMUGVuZGluZ0FkbWluAAAAAQAAAC5Qcm9wb3NlZCB1cGdyYWRlIFdBU00gaGFzaCAoSW5zdGFuY2Ugc3RvcmFnZSkuAAAAAAAPUHJvcG9zZWRVcGdyYWRlAAAAAAEAAAPuAAAAIAAAAAAAAABSTGVkZ2VyIHNlcXVlbmNlIGF0IHdoaWNoIGEgcHJvcG9zZWQgdXBncmFkZSBiZWNvbWVzIGV4ZWN1dGFibGUgKEluc3RhbmNlIHN0b3JhZ2UpLgAAAAAAE1VwZ3JhZGVVbmxvY2tMZWRnZXIA" ]),
      options
    )
  }
  public readonly fromJSON = {
    pause: this.txFromJSON<null>,
        create: this.txFromJSON<u64>,
        refund: this.txFromJSON<null>,
        deposit: this.txFromJSON<null>,
        restart: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        withdraw: this.txFromJSON<null>,
        set_admin: this.txFromJSON<null>,
        status_of: this.txFromJSON<StreamStatus>,
        get_stream: this.txFromJSON<FlowStream>,
        initialize: this.txFromJSON<null>,
        refund_max: this.txFromJSON<i128>,
        adjust_rate: this.txFromJSON<null>,
        get_balance: this.txFromJSON<i128>,
        void_stream: this.txFromJSON<null>,
        accept_admin: this.txFromJSON<null>,
        withdraw_max: this.txFromJSON<i128>,
        propose_admin: this.txFromJSON<null>,
        total_debt_of: this.txFromJSON<i128>,
        covered_debt_of: this.txFromJSON<i128>,
        execute_upgrade: this.txFromJSON<null>,
        propose_upgrade: this.txFromJSON<null>,
        depletion_time_of: this.txFromJSON<u64>,
        extend_stream_ttl: this.txFromJSON<null>,
        uncovered_debt_of: this.txFromJSON<i128>,
        create_and_deposit: this.txFromJSON<u64>,
        get_rate_per_second: this.txFromJSON<i128>,
        refundable_amount_of: this.txFromJSON<i128>,
        withdrawable_amount_of: this.txFromJSON<i128>
  }
}
