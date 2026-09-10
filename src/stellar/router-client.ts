import {
  FUNDABLE_ERROR_CODES,
  FundableError,
  CANONICAL_STREAM_STATUSES,
  STREAM_KINDS,
  toFundableError,
  toUnixSeconds,
  type CreateFlowInput,
  type CreateLockupInput,
  type RouterWithdrawInput,
  type CanonicalStreamStatus,
  type StreamMetadata,
} from "../core/index.js";
import {
  CanonicalStreamStatus as GeneratedCanonicalStreamStatus,
  Client as GeneratedRouterClient,
  StreamType as GeneratedStreamType,
} from "../generated/router/src/index.js";
import type { StellarFundableClientConfig, StellarMethodOptions } from "./types.js";
import type { StellarTransaction } from "./flow-client.js";
import {
  assertPositive,
  assertNonNegative,
  assertStellarAddress,
  assertTokenDecimals,
  toTokenId,
} from "./validation.js";

const CANONICAL_STATUS_BY_CONTRACT_VALUE: Record<number, CanonicalStreamStatus> = {
  [GeneratedCanonicalStreamStatus.Pending]: CANONICAL_STREAM_STATUSES.PENDING,
  [GeneratedCanonicalStreamStatus.Active]: CANONICAL_STREAM_STATUSES.ACTIVE,
  [GeneratedCanonicalStreamStatus.Paused]: CANONICAL_STREAM_STATUSES.PAUSED,
  [GeneratedCanonicalStreamStatus.Canceled]: CANONICAL_STREAM_STATUSES.CANCELED,
  [GeneratedCanonicalStreamStatus.Completed]: CANONICAL_STREAM_STATUSES.COMPLETED,
  [GeneratedCanonicalStreamStatus.Failed]: CANONICAL_STREAM_STATUSES.FAILED,
};

export class StellarRouterClient {
  private readonly client: GeneratedRouterClient;

  constructor(config: StellarFundableClientConfig & { contracts: { router: string } }) {
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

  async createFlow(
    input: CreateFlowInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<bigint>> {
    assertStellarAddress(input.sender, "Sender");
    assertStellarAddress(input.recipient, "Recipient");
    assertStellarAddress(input.token.address, "Token");
    assertPositive(input.ratePerSecond, "Rate per second");
    assertTokenDecimals(input.token.decimals, "Flow token decimals");

    return this.client.create_flow_stream(
      {
        sender: input.sender,
        recipient: input.recipient,
        token: input.token.address,
        rate_per_second: input.ratePerSecond,
        token_decimals: input.token.decimals,
        start_time: toUnixSeconds(input.startTime),
        initial_amount: input.initialAmount ?? 0n,
        transferable: input.transferable ?? false,
      },
      options,
    );
  }

  async createLockup(
    input: CreateLockupInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<bigint>> {
    assertStellarAddress(input.sender, "Sender");
    assertStellarAddress(input.recipient, "Recipient");
    assertStellarAddress(input.token.address, "Token");
    assertTokenDecimals(input.token.decimals, "Lockup token decimals");
    assertPositive(input.totalAmount, "Total amount");

    if (input.sender === input.recipient) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "Sender and recipient must be different addresses.",
        chain: "stellar",
      });
    }

    const startTime = toUnixSeconds(input.startTime, "Start time");
    const endTime = toUnixSeconds(input.endTime, "End time");
    const cliffTime = toUnixSeconds(input.cliffTime, "Cliff time");
    const startUnlockAmount = input.startUnlockAmount ?? 0n;
    const cliffUnlockAmount = input.cliffUnlockAmount ?? 0n;
    const granularity = input.granularitySeconds ?? 1n;

    if (endTime <= startTime) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "End time must be later than start time.",
        chain: "stellar",
      });
    }
    if (cliffTime > 0n && (cliffTime <= startTime || cliffTime >= endTime)) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "Cliff time must be later than start time and earlier than end time.",
        chain: "stellar",
      });
    }
    assertNonNegative(startUnlockAmount, "Start unlock amount");
    assertNonNegative(cliffUnlockAmount, "Cliff unlock amount");
    assertPositive(granularity, "Granularity");
    if (startUnlockAmount + cliffUnlockAmount > input.totalAmount) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "Start and cliff unlock amounts cannot exceed the total amount.",
        chain: "stellar",
      });
    }

    return this.client.create_lockup_stream(
      {
        params: {
          sender: input.sender,
          recipient: input.recipient,
          token: input.token.address,
          total_amount: input.totalAmount,
          start_time: startTime,
          end_time: endTime,
          cliff_time: cliffTime,
          start_unlock_amount: startUnlockAmount,
          cliff_unlock_amount: cliffUnlockAmount,
          granularity,
          cancelable: input.cancelable ?? false,
        },
        transferable: input.transferable ?? false,
      },
      options,
    );
  }

  async withdraw(
    input: RouterWithdrawInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.caller, "Caller");
    assertStellarAddress(input.to, "Withdrawal destination");
    assertPositive(input.amount, "Withdrawal amount");
    return this.client.withdraw(
      {
        token_id: toTokenId(input.tokenId),
        caller: input.caller,
        to: input.to,
        amount: input.amount,
      },
      options,
    );
  }

  async withdrawMax(
    input: Omit<RouterWithdrawInput, "amount">,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<bigint>> {
    assertStellarAddress(input.caller, "Caller");
    assertStellarAddress(input.to, "Withdrawal destination");
    return this.client.withdraw_max(
      {
        token_id: toTokenId(input.tokenId),
        caller: input.caller,
        to: input.to,
      },
      options,
    );
  }

  async ownerOf(tokenId: string | bigint): Promise<string> {
    try {
      const transaction = await this.client.owner_of({ token_id: toTokenId(tokenId) });
      return transaction.result;
    } catch (error) {
      throw toFundableError(error, "Failed to load the current stream owner.", "stellar");
    }
  }

  async statusOf(tokenId: string | bigint): Promise<CanonicalStreamStatus> {
    try {
      const transaction = await this.client.status_of({ token_id: toTokenId(tokenId) });
      const status = CANONICAL_STATUS_BY_CONTRACT_VALUE[transaction.result];
      if (!status) throw new Error(`Unknown canonical stream status: ${transaction.result}`);
      return status;
    } catch (error) {
      throw toFundableError(error, "Failed to load the canonical stream status.", "stellar");
    }
  }

  async coreStreamId(tokenId: string | bigint): Promise<string> {
    try {
      const transaction = await this.client.core_stream_id({ token_id: toTokenId(tokenId) });
      return transaction.result.toString();
    } catch (error) {
      throw toFundableError(error, "Failed to load the core stream ID.", "stellar");
    }
  }

  async getStream(tokenId: string | bigint): Promise<StreamMetadata> {
    try {
      const transaction = await this.client.get_stream({ token_id: toTokenId(tokenId) });
      const metadata = transaction.result;
      const status = CANONICAL_STATUS_BY_CONTRACT_VALUE[metadata.status];
      if (!status) throw new Error(`Unknown canonical stream status: ${metadata.status}`);
      if (
        metadata.stream_type !== GeneratedStreamType.Flow &&
        metadata.stream_type !== GeneratedStreamType.Lockup
      ) {
        throw new Error(`Unknown stream type: ${metadata.stream_type}`);
      }
      return {
        tokenId: metadata.token_id.toString(),
        coreStreamId: metadata.core_stream_id.toString(),
        streamKind:
          metadata.stream_type === GeneratedStreamType.Flow
            ? STREAM_KINDS.FLOW
            : STREAM_KINDS.LOCKUP,
        status,
        owner: metadata.owner,
        transferable: metadata.transferable,
      };
    } catch (error) {
      throw toFundableError(error, "Failed to load stream metadata.", "stellar");
    }
  }

  async voidFlow(
    input: { tokenId: string | bigint; caller: string },
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.caller, "Caller");
    return this.client.void_flow(
      { token_id: toTokenId(input.tokenId), caller: input.caller },
      options,
    );
  }
}
