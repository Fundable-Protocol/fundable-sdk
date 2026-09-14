import { Buffer } from "buffer";
import { FUNDABLE_ERROR_CODES, FundableError } from "../core/index.js";
import { Client as GeneratedFlowClient } from "../generated/flow/src/index.js";
import { Client as GeneratedLockupClient } from "../generated/lockup/src/index.js";
import { Client as GeneratedRouterClient } from "../generated/router/src/index.js";
import { toFundableError } from "./error-parser.js";
import type { StellarTransaction } from "./flow-client.js";
import type { StellarFundableClientConfig, StellarMethodOptions } from "./types.js";
import {
  assertContractId,
  assertStellarAddress,
  toStreamId,
} from "./validation.js";

export function toWasmHashBuffer(hash: string | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(hash)) {
    if (hash.length !== 32) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "WASM hash must be exactly 32 bytes.",
        chain: "stellar",
      });
    }
    return hash;
  }

  if (hash instanceof Uint8Array) {
    if (hash.length !== 32) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "WASM hash must be exactly 32 bytes.",
        chain: "stellar",
      });
    }
    return Buffer.from(hash);
  }

  if (typeof hash === "string") {
    const clean = hash.trim().replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "WASM hash must be a 64-character hex string (32 bytes).",
        chain: "stellar",
      });
    }
    return Buffer.from(clean, "hex");
  }

  throw new FundableError({
    code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
    message: "WASM hash must be a hex string or 32-byte Buffer.",
    chain: "stellar",
  });
}

export class StellarFlowAdminClient {
  private readonly client: GeneratedFlowClient;

  constructor(config: StellarFundableClientConfig) {
    assertContractId(config.contracts.flow, "Flow contract");
    this.client = new GeneratedFlowClient({
      contractId: config.contracts.flow,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      publicKey: config.publicKey,
      allowHttp: config.allowHttp,
      headers: config.headers,
      signTransaction: config.signTransaction,
      signAuthEntry: config.signAuthEntry,
    });
  }

  async proposeUpgrade(
    newWasmHash: string | Buffer | Uint8Array,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      const hash = toWasmHashBuffer(newWasmHash);
      return await this.client.propose_upgrade({ new_wasm_hash: hash }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to propose Flow contract upgrade.");
    }
  }

  async executeUpgrade(
    newWasmHash: string | Buffer | Uint8Array,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      const hash = toWasmHashBuffer(newWasmHash);
      return await this.client.execute_upgrade({ new_wasm_hash: hash }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to execute Flow contract upgrade.");
    }
  }

  async upgrade(
    newWasmHash: string | Buffer | Uint8Array,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      const hash = toWasmHashBuffer(newWasmHash);
      return await this.client.upgrade({ new_wasm_hash: hash }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to upgrade Flow contract.");
    }
  }

  async proposeAdmin(
    newAdmin: string,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(newAdmin, "New admin address");
    try {
      return await this.client.propose_admin({ new_admin: newAdmin }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to propose Flow admin.");
    }
  }

  async acceptAdmin(options?: StellarMethodOptions): Promise<StellarTransaction<null>> {
    try {
      return await this.client.accept_admin(options);
    } catch (error) {
      throw toFundableError(error, "Failed to accept Flow admin transfer.");
    }
  }

  async extendStreamTtl(
    streamId: string | bigint,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      return await this.client.extend_stream_ttl(
        { stream_id: toStreamId(streamId) },
        options,
      );
    } catch (error) {
      throw toFundableError(error, "Failed to extend Flow stream TTL.");
    }
  }
}

export class StellarLockupAdminClient {
  private readonly client: GeneratedLockupClient;

  constructor(config: StellarFundableClientConfig & { contracts: { lockup: string } }) {
    assertContractId(config.contracts.lockup, "Lockup contract");
    this.client = new GeneratedLockupClient({
      contractId: config.contracts.lockup,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      publicKey: config.publicKey,
      allowHttp: config.allowHttp,
      headers: config.headers,
      signTransaction: config.signTransaction,
      signAuthEntry: config.signAuthEntry,
    });
  }

  async proposeUpgrade(
    newWasmHash: string | Buffer | Uint8Array,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      const hash = toWasmHashBuffer(newWasmHash);
      return await this.client.propose_upgrade({ new_wasm_hash: hash }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to propose Lockup contract upgrade.");
    }
  }

  async executeUpgrade(
    newWasmHash: string | Buffer | Uint8Array,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      const hash = toWasmHashBuffer(newWasmHash);
      return await this.client.execute_upgrade({ new_wasm_hash: hash }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to execute Lockup contract upgrade.");
    }
  }

  async upgrade(
    newWasmHash: string | Buffer | Uint8Array,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      const hash = toWasmHashBuffer(newWasmHash);
      return await this.client.upgrade({ new_wasm_hash: hash }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to upgrade Lockup contract.");
    }
  }

  async proposeAdmin(
    newAdmin: string,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(newAdmin, "New admin address");
    try {
      return await this.client.propose_admin({ new_admin: newAdmin }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to propose Lockup admin.");
    }
  }

  async acceptAdmin(options?: StellarMethodOptions): Promise<StellarTransaction<null>> {
    try {
      return await this.client.accept_admin(options);
    } catch (error) {
      throw toFundableError(error, "Failed to accept Lockup admin transfer.");
    }
  }

  async extendStreamTtl(
    streamId: string | bigint,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      return await this.client.extend_stream_ttl(
        { stream_id: toStreamId(streamId) },
        options,
      );
    } catch (error) {
      throw toFundableError(error, "Failed to extend Lockup stream TTL.");
    }
  }
}

export class StellarRouterAdminClient {
  private readonly client: GeneratedRouterClient;

  constructor(config: StellarFundableClientConfig & { contracts: { router: string } }) {
    assertContractId(config.contracts.router, "Router contract");
    this.client = new GeneratedRouterClient({
      contractId: config.contracts.router,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      publicKey: config.publicKey,
      allowHttp: config.allowHttp,
      headers: config.headers,
      signTransaction: config.signTransaction,
      signAuthEntry: config.signAuthEntry,
    });
  }

  async proposeUpgrade(
    newWasmHash: string | Buffer | Uint8Array,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      const hash = toWasmHashBuffer(newWasmHash);
      return await this.client.propose_upgrade({ new_wasm_hash: hash }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to propose Router contract upgrade.");
    }
  }

  async executeUpgrade(
    newWasmHash: string | Buffer | Uint8Array,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      const hash = toWasmHashBuffer(newWasmHash);
      return await this.client.execute_upgrade({ new_wasm_hash: hash }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to execute Router contract upgrade.");
    }
  }

  async upgrade(
    newWasmHash: string | Buffer | Uint8Array,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      const hash = toWasmHashBuffer(newWasmHash);
      return await this.client.upgrade({ new_wasm_hash: hash }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to upgrade Router contract.");
    }
  }

  async upgradeNft(
    newWasmHash: string | Buffer | Uint8Array,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      const hash = toWasmHashBuffer(newWasmHash);
      return await this.client.upgrade_nft({ new_wasm_hash: hash }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to upgrade NFT contract via Router.");
    }
  }

  async proposeAdmin(
    newAdmin: string,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(newAdmin, "New admin address");
    try {
      return await this.client.propose_admin({ new_admin: newAdmin }, options);
    } catch (error) {
      throw toFundableError(error, "Failed to propose Router admin.");
    }
  }

  async acceptAdmin(options?: StellarMethodOptions): Promise<StellarTransaction<null>> {
    try {
      return await this.client.accept_admin(options);
    } catch (error) {
      throw toFundableError(error, "Failed to accept Router admin transfer.");
    }
  }
}

export class StellarAdminClient {
  readonly flows: StellarFlowAdminClient;
  readonly lockups?: StellarLockupAdminClient;
  readonly router?: StellarRouterAdminClient;

  constructor(config: StellarFundableClientConfig) {
    this.flows = new StellarFlowAdminClient(config);

    if (config.contracts.lockup) {
      this.lockups = new StellarLockupAdminClient({
        ...config,
        contracts: { ...config.contracts, lockup: config.contracts.lockup },
      });
    }

    if (config.contracts.router) {
      this.router = new StellarRouterAdminClient({
        ...config,
        contracts: { ...config.contracts, router: config.contracts.router },
      });
    }
  }
}
