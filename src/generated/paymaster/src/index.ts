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

export interface Client {
  /**
   * Construct and simulate a sweep transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sweep accumulated fee tokens to a recipient address.
   * 
   * # Auth
   * Requires admin authorization.
   */
  sweep: ({token, to}: {token: string, to: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a forward transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Atomically collect a token fee from the user and invoke the target
   * contract function, using the OpenZeppelin fee abstraction helpers.
   * 
   * The user must authorize both the fee transfer and the downstream
   * contract invocation via Soroban's native auth framework.
   * 
   * # Arguments
   * * `user` — The end user paying the fee and authorizing the call.
   * * `fee_token` — The SAC/SEP-41 token used for fee payment.
   * * `fee_amount` — The actual fee amount to transfer from user.
   * * `max_fee_amount` — The maximum fee the user authorized.
   * * `expiration_ledger` — The ledger at which the approval expires.
   * * `fee_recipient` — The address receiving the fee (typically the relayer).
   * * `target_contract` — The contract to invoke (e.g. Router).
   * * `function_name` — The function to call on the target contract.
   * * `args` — Arguments to pass to the target function.
   * 
   * # Returns
   * The raw `Val` result from the target contract invocation.
   * 
   * # Errors
   * * `PaymasterError::NotInitialized` — contract not initialized.
   * * `PaymasterError::TokenNotAl
   */
  forward: ({user, fee_token, fee_amount, max_fee_amount, expiration_ledger, fee_recipient, target_contract, function_name, args}: {user: string, fee_token: string, fee_amount: i128, max_fee_amount: i128, expiration_ledger: u32, fee_recipient: string, target_contract: string, function_name: string, args: Array<any>}, options?: MethodOptions) => Promise<AssembledTransaction<any>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract WASM bytecode.
   * 
   * # Auth
   * Requires admin authorization.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the admin address.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the Paymaster with an admin and an initial list of
   * allowed fee tokens.
   * 
   * # Arguments
   * * `admin` — The admin address (can upgrade and manage token whitelist).
   * * `allowed_fee_tokens` — Initial list of token addresses accepted
   * for fee payment.
   * 
   * # Errors
   * * `PaymasterError::AlreadyInitialized` — if called more than once.
   */
  initialize: ({admin, allowed_fee_tokens}: {admin: string, allowed_fee_tokens: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a add_fee_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Add a token to the allowed fee token whitelist.
   * 
   * # Auth
   * Requires admin authorization.
   */
  add_fee_token: ({token}: {token: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a remove_fee_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Remove a token from the allowed fee token whitelist.
   * 
   * # Auth
   * Requires admin authorization.
   */
  remove_fee_token: ({token}: {token: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a is_fee_token_allowed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if a specific token is in the allowed fee token list.
   */
  is_fee_token_allowed: ({token}: {token: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a collect_fee_and_invoke transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Backwards-compatible entry point matching the original Paymaster API.
   * 
   * This wraps `forward()` with a simplified interface where the relayer
   * address is the fee recipient and fee_amount == max_fee.
   */
  collect_fee_and_invoke: ({user, fee_token, max_fee, relayer, target_contract, function_name, args}: {user: string, fee_token: string, max_fee: i128, relayer: string, target_contract: string, function_name: string, args: Array<any>}, options?: MethodOptions) => Promise<AssembledTransaction<any>>

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
      new ContractSpec([ "AAAAAAAAAFpTd2VlcCBhY2N1bXVsYXRlZCBmZWUgdG9rZW5zIHRvIGEgcmVjaXBpZW50IGFkZHJlc3MuCgojIEF1dGgKUmVxdWlyZXMgYWRtaW4gYXV0aG9yaXphdGlvbi4AAAAAAAVzd2VlcAAAAAAAAAIAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAACdG8AAAAAABMAAAAA",
        "AAAAAAAABABBdG9taWNhbGx5IGNvbGxlY3QgYSB0b2tlbiBmZWUgZnJvbSB0aGUgdXNlciBhbmQgaW52b2tlIHRoZSB0YXJnZXQKY29udHJhY3QgZnVuY3Rpb24sIHVzaW5nIHRoZSBPcGVuWmVwcGVsaW4gZmVlIGFic3RyYWN0aW9uIGhlbHBlcnMuCgpUaGUgdXNlciBtdXN0IGF1dGhvcml6ZSBib3RoIHRoZSBmZWUgdHJhbnNmZXIgYW5kIHRoZSBkb3duc3RyZWFtCmNvbnRyYWN0IGludm9jYXRpb24gdmlhIFNvcm9iYW4ncyBuYXRpdmUgYXV0aCBmcmFtZXdvcmsuCgojIEFyZ3VtZW50cwoqIGB1c2VyYCDigJQgVGhlIGVuZCB1c2VyIHBheWluZyB0aGUgZmVlIGFuZCBhdXRob3JpemluZyB0aGUgY2FsbC4KKiBgZmVlX3Rva2VuYCDigJQgVGhlIFNBQy9TRVAtNDEgdG9rZW4gdXNlZCBmb3IgZmVlIHBheW1lbnQuCiogYGZlZV9hbW91bnRgIOKAlCBUaGUgYWN0dWFsIGZlZSBhbW91bnQgdG8gdHJhbnNmZXIgZnJvbSB1c2VyLgoqIGBtYXhfZmVlX2Ftb3VudGAg4oCUIFRoZSBtYXhpbXVtIGZlZSB0aGUgdXNlciBhdXRob3JpemVkLgoqIGBleHBpcmF0aW9uX2xlZGdlcmAg4oCUIFRoZSBsZWRnZXIgYXQgd2hpY2ggdGhlIGFwcHJvdmFsIGV4cGlyZXMuCiogYGZlZV9yZWNpcGllbnRgIOKAlCBUaGUgYWRkcmVzcyByZWNlaXZpbmcgdGhlIGZlZSAodHlwaWNhbGx5IHRoZSByZWxheWVyKS4KKiBgdGFyZ2V0X2NvbnRyYWN0YCDigJQgVGhlIGNvbnRyYWN0IHRvIGludm9rZSAoZS5nLiBSb3V0ZXIpLgoqIGBmdW5jdGlvbl9uYW1lYCDigJQgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgb24gdGhlIHRhcmdldCBjb250cmFjdC4KKiBgYXJnc2Ag4oCUIEFyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSB0YXJnZXQgZnVuY3Rpb24uCgojIFJldHVybnMKVGhlIHJhdyBgVmFsYCByZXN1bHQgZnJvbSB0aGUgdGFyZ2V0IGNvbnRyYWN0IGludm9jYXRpb24uCgojIEVycm9ycwoqIGBQYXltYXN0ZXJFcnJvcjo6Tm90SW5pdGlhbGl6ZWRgIOKAlCBjb250cmFjdCBub3QgaW5pdGlhbGl6ZWQuCiogYFBheW1hc3RlckVycm9yOjpUb2tlbk5vdEFsAAAAB2ZvcndhcmQAAAAACQAAAAAAAAAEdXNlcgAAABMAAAAAAAAACWZlZV90b2tlbgAAAAAAABMAAAAAAAAACmZlZV9hbW91bnQAAAAAAAsAAAAAAAAADm1heF9mZWVfYW1vdW50AAAAAAALAAAAAAAAABFleHBpcmF0aW9uX2xlZGdlcgAAAAAAAAQAAAAAAAAADWZlZV9yZWNpcGllbnQAAAAAAAATAAAAAAAAAA90YXJnZXRfY29udHJhY3QAAAAAEwAAAAAAAAANZnVuY3Rpb25fbmFtZQAAAAAAABEAAAAAAAAABGFyZ3MAAAPqAAAAAAAAAAEAAAAA",
        "AAAAAAAAAElVcGdyYWRlIHRoZSBjb250cmFjdCBXQVNNIGJ5dGVjb2RlLgoKIyBBdXRoClJlcXVpcmVzIGFkbWluIGF1dGhvcml6YXRpb24uAAAAAAAAB3VwZ3JhZGUAAAAAAQAAAAAAAAANbmV3X3dhc21faGFzaAAAAAAAA+4AAAAgAAAAAA==",
        "AAAAAAAAABpSZXR1cm5zIHRoZSBhZG1pbiBhZGRyZXNzLgAAAAAACWdldF9hZG1pbgAAAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAAUxJbml0aWFsaXplIHRoZSBQYXltYXN0ZXIgd2l0aCBhbiBhZG1pbiBhbmQgYW4gaW5pdGlhbCBsaXN0IG9mCmFsbG93ZWQgZmVlIHRva2Vucy4KCiMgQXJndW1lbnRzCiogYGFkbWluYCDigJQgVGhlIGFkbWluIGFkZHJlc3MgKGNhbiB1cGdyYWRlIGFuZCBtYW5hZ2UgdG9rZW4gd2hpdGVsaXN0KS4KKiBgYWxsb3dlZF9mZWVfdG9rZW5zYCDigJQgSW5pdGlhbCBsaXN0IG9mIHRva2VuIGFkZHJlc3NlcyBhY2NlcHRlZApmb3IgZmVlIHBheW1lbnQuCgojIEVycm9ycwoqIGBQYXltYXN0ZXJFcnJvcjo6QWxyZWFkeUluaXRpYWxpemVkYCDigJQgaWYgY2FsbGVkIG1vcmUgdGhhbiBvbmNlLgAAAAppbml0aWFsaXplAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAEmFsbG93ZWRfZmVlX3Rva2VucwAAAAAD6gAAABMAAAAA",
        "AAAAAAAAAFVBZGQgYSB0b2tlbiB0byB0aGUgYWxsb3dlZCBmZWUgdG9rZW4gd2hpdGVsaXN0LgoKIyBBdXRoClJlcXVpcmVzIGFkbWluIGF1dGhvcml6YXRpb24uAAAAAAAADWFkZF9mZWVfdG9rZW4AAAAAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAA",
        "AAAAAAAAAFpSZW1vdmUgYSB0b2tlbiBmcm9tIHRoZSBhbGxvd2VkIGZlZSB0b2tlbiB3aGl0ZWxpc3QuCgojIEF1dGgKUmVxdWlyZXMgYWRtaW4gYXV0aG9yaXphdGlvbi4AAAAAABByZW1vdmVfZmVlX3Rva2VuAAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAA==",
        "AAAAAAAAADtDaGVjayBpZiBhIHNwZWNpZmljIHRva2VuIGlzIGluIHRoZSBhbGxvd2VkIGZlZSB0b2tlbiBsaXN0LgAAAAAUaXNfZmVlX3Rva2VuX2FsbG93ZWQAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAAMNCYWNrd2FyZHMtY29tcGF0aWJsZSBlbnRyeSBwb2ludCBtYXRjaGluZyB0aGUgb3JpZ2luYWwgUGF5bWFzdGVyIEFQSS4KClRoaXMgd3JhcHMgYGZvcndhcmQoKWAgd2l0aCBhIHNpbXBsaWZpZWQgaW50ZXJmYWNlIHdoZXJlIHRoZSByZWxheWVyCmFkZHJlc3MgaXMgdGhlIGZlZSByZWNpcGllbnQgYW5kIGZlZV9hbW91bnQgPT0gbWF4X2ZlZS4AAAAAFmNvbGxlY3RfZmVlX2FuZF9pbnZva2UAAAAAAAcAAAAAAAAABHVzZXIAAAATAAAAAAAAAAlmZWVfdG9rZW4AAAAAAAATAAAAAAAAAAdtYXhfZmVlAAAAAAsAAAAAAAAAB3JlbGF5ZXIAAAAAEwAAAAAAAAAPdGFyZ2V0X2NvbnRyYWN0AAAAABMAAAAAAAAADWZ1bmN0aW9uX25hbWUAAAAAAAARAAAAAAAAAARhcmdzAAAD6gAAAAAAAAABAAAAAA==",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSBzd2VwdCBmcm9tIHRoZSBjb250cmFjdC4AAAAAAAAAAAALVG9rZW5zU3dlcHQAAAAAAQAAAAx0b2tlbnNfc3dlcHQAAAADAAAAAAAAAAV0b2tlbgAAAAAAABMAAAABAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAADJFdmVudCBlbWl0dGVkIHdoZW4gYSBmZWUgaXMgY29sbGVjdGVkIGZyb20gYSB1c2VyLgAAAAAAAAAAAAxGZWVDb2xsZWN0ZWQAAAABAAAADWZlZV9jb2xsZWN0ZWQAAAAAAAAEAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAADxFdmVudCBlbWl0dGVkIHdoZW4gYSBjYWxsIGlzIGZvcndhcmRlZCB0byBhIHRhcmdldCBjb250cmFjdC4AAAAAAAAAD0ZvcndhcmRFeGVjdXRlZAAAAAABAAAAEGZvcndhcmRfZXhlY3V0ZWQAAAAEAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAAAAAAD3RhcmdldF9jb250cmFjdAAAAAATAAAAAQAAAAAAAAAJdGFyZ2V0X2ZuAAAAAAAAEQAAAAAAAAAAAAAAC3RhcmdldF9hcmdzAAAAA+oAAAAAAAAAAAAAAAI=",
        "AAAABQAAAEZFdmVudCBlbWl0dGVkIHdoZW4gYSBmZWUgdG9rZW4gaXMgYWRkZWQgb3IgcmVtb3ZlZCBmcm9tIHRoZSBhbGxvd2xpc3QuAAAAAAAAAAAAGEZlZVRva2VuQWxsb3dsaXN0VXBkYXRlZAAAAAEAAAAbZmVlX3Rva2VuX2FsbG93bGlzdF91cGRhdGVkAAAAAAIAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAAAAAAAB2FsbG93ZWQAAAAAAQAAAAAAAAAC" ]),
      options
    )
  }
  public readonly fromJSON = {
    sweep: this.txFromJSON<null>,
        forward: this.txFromJSON<any>,
        upgrade: this.txFromJSON<null>,
        get_admin: this.txFromJSON<string>,
        initialize: this.txFromJSON<null>,
        add_fee_token: this.txFromJSON<null>,
        remove_fee_token: this.txFromJSON<null>,
        is_fee_token_allowed: this.txFromJSON<boolean>,
        collect_fee_and_invoke: this.txFromJSON<any>
  }
}
