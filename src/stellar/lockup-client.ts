import {
  LOCKUP_STATUSES,
  toFundableError,
  type LockupActorInput,
  type LockupStatus,
} from "../core/index.js";
import {
  Client as GeneratedLockupClient,
  LockupStatus as GeneratedLockupStatus,
} from "../generated/lockup/src/index.js";
import type { StellarTransaction } from "./flow-client.js";
import type {
  StellarFundableClientConfig,
  StellarMethodOptions,
} from "./types.js";
import { assertStellarAddress, toStreamId } from "./validation.js";

const LOCKUP_STATUS_BY_CONTRACT_VALUE: Record<number, LockupStatus> = {
  [GeneratedLockupStatus.Pending]: LOCKUP_STATUSES.PENDING,
  [GeneratedLockupStatus.Streaming]: LOCKUP_STATUSES.STREAMING,
  [GeneratedLockupStatus.Settled]: LOCKUP_STATUSES.SETTLED,
  [GeneratedLockupStatus.Canceled]: LOCKUP_STATUSES.CANCELED,
  [GeneratedLockupStatus.Depleted]: LOCKUP_STATUSES.DEPLETED,
};

export class StellarLockupClient {
  private readonly client: GeneratedLockupClient;

  constructor(
    config: StellarFundableClientConfig & { contracts: { lockup: string } },
  ) {
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

  async cancel(
    input: LockupActorInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<bigint>> {
    assertStellarAddress(input.sender, "Lockup sender");
    return this.client.cancel(
      { stream_id: toStreamId(input.streamId), sender: input.sender },
      options,
    );
  }

  async renounce(
    input: LockupActorInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.sender, "Lockup sender");
    return this.client.renounce(
      { stream_id: toStreamId(input.streamId), sender: input.sender },
      options,
    );
  }

  async statusOf(streamId: string | bigint): Promise<LockupStatus> {
    try {
      const transaction = await this.client.status_of({
        stream_id: toStreamId(streamId),
      });
      const status = LOCKUP_STATUS_BY_CONTRACT_VALUE[transaction.result];
      if (!status) throw new Error(`Unknown Lockup status: ${transaction.result}`);
      return status;
    } catch (error) {
      throw toFundableError(error, "Failed to load the Lockup status.", "stellar");
    }
  }

  async isCancelable(streamId: string | bigint): Promise<boolean> {
    try {
      const transaction = await this.client.is_cancelable({
        stream_id: toStreamId(streamId),
      });
      return transaction.result;
    } catch (error) {
      throw toFundableError(error, "Failed to load Lockup cancellation state.", "stellar");
    }
  }

  async withdrawableAmount(streamId: string | bigint): Promise<bigint> {
    return this.readAmount("withdrawable", streamId);
  }

  async refundableAmount(streamId: string | bigint): Promise<bigint> {
    return this.readAmount("refundable", streamId);
  }

  private async readAmount(
    kind: "withdrawable" | "refundable",
    streamId: string | bigint,
  ): Promise<bigint> {
    try {
      const args = { stream_id: toStreamId(streamId) };
      const transaction =
        kind === "withdrawable"
          ? await this.client.withdrawable_amount_of(args)
          : await this.client.refundable_amount_of(args);
      return transaction.result;
    } catch (error) {
      throw toFundableError(error, `Failed to load the ${kind} Lockup amount.`, "stellar");
    }
  }
}
