import {
  FUNDABLE_ERROR_CODES,
  FundableError,
  CANONICAL_STREAM_STATUSES,
  STREAM_KINDS,
  toUnixSeconds,
  type CreateFlowInput,
  type CreateLockupInput,
  type RouterWithdrawInput,
  type CanonicalStreamStatus,
  type StreamMetadata,
} from "../core/index.js";
import { toFundableError } from "./error-parser.js";
import { Client as GeneratedRouterClient } from "../generated/router/src/index.js";
import {
  Client as GeneratedStreamNftClient,
  StreamType as GeneratedStreamType,
} from "../generated/stream_nft/src/index.js";
import {
  Client as GeneratedFlowClient,
  StreamStatus as GeneratedFlowStatus,
} from "../generated/flow/src/index.js";
import {
  Client as GeneratedLockupClient,
  LockupStatus as GeneratedLockupStatus,
} from "../generated/lockup/src/index.js";
import type { StellarFundableClientConfig, StellarMethodOptions } from "./types.js";
import type { StellarTransaction } from "./flow-client.js";
import {
  assertPositive,
  assertLockupUnlockAmounts,
  assertStellarAddress,
  assertTokenDecimals,
  toStreamId,
  toTokenId,
} from "./validation.js";

const CANONICAL_FLOW_STATUS: Record<number, CanonicalStreamStatus> = {
  [GeneratedFlowStatus.Pending]: CANONICAL_STREAM_STATUSES.PENDING,
  [GeneratedFlowStatus.StreamingSolvent]: CANONICAL_STREAM_STATUSES.ACTIVE,
  [GeneratedFlowStatus.StreamingInsolvent]: CANONICAL_STREAM_STATUSES.ACTIVE,
  [GeneratedFlowStatus.PausedSolvent]: CANONICAL_STREAM_STATUSES.PAUSED,
  [GeneratedFlowStatus.PausedInsolvent]: CANONICAL_STREAM_STATUSES.PAUSED,
  [GeneratedFlowStatus.Voided]: CANONICAL_STREAM_STATUSES.CANCELED,
};

const CANONICAL_LOCKUP_STATUS: Record<number, CanonicalStreamStatus> = {
  [GeneratedLockupStatus.Pending]: CANONICAL_STREAM_STATUSES.PENDING,
  [GeneratedLockupStatus.Streaming]: CANONICAL_STREAM_STATUSES.ACTIVE,
  [GeneratedLockupStatus.Settled]: CANONICAL_STREAM_STATUSES.COMPLETED,
  [GeneratedLockupStatus.Canceled]: CANONICAL_STREAM_STATUSES.CANCELED,
  [GeneratedLockupStatus.Depleted]: CANONICAL_STREAM_STATUSES.COMPLETED,
};

export class StellarRouterClient {
  private readonly client: GeneratedRouterClient;
  private readonly streamNftClient?: GeneratedStreamNftClient;
  private readonly flowClient?: GeneratedFlowClient;
  private readonly lockupClient?: GeneratedLockupClient;

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

    if (config.contracts.streamNft) {
      this.streamNftClient = new GeneratedStreamNftClient({
        contractId: config.contracts.streamNft,
        networkPassphrase: config.networkPassphrase,
        rpcUrl: config.rpcUrl,
        publicKey: config.publicKey,
        allowHttp: config.allowHttp,
        headers: config.headers,
        signTransaction: config.signTransaction,
        signAuthEntry: config.signAuthEntry,
      });
    }

    if (config.contracts.flow) {
      this.flowClient = new GeneratedFlowClient({
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

    if (config.contracts.lockup) {
      this.lockupClient = new GeneratedLockupClient({
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

    try {
      return await this.client.create_flow_stream(
        {
          sender: input.sender,
          recipient: input.recipient,
          token: input.token.address,
          rate_per_second: input.ratePerSecond,
          token_decimals: input.token.decimals,
          start_time: toUnixSeconds(input.startTime),
        },
        options,
      );
    } catch (error) {
      throw toFundableError(error, "Failed to create Flow stream via Router.");
    }
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
    assertPositive(granularity, "Granularity");
    assertLockupUnlockAmounts(startUnlockAmount, cliffUnlockAmount, input.totalAmount);

    try {
      return await this.client.create_lockup_stream(
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
        },
        options,
      );
    } catch (error) {
      throw toFundableError(error, "Failed to create Lockup stream via Router.");
    }
  }

  async withdraw(
    input: RouterWithdrawInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.caller, "Caller");
    assertStellarAddress(input.to, "Withdrawal destination");
    assertPositive(input.amount, "Withdrawal amount");
    try {
      return await this.client.withdraw(
        {
          token_id: toTokenId(input.tokenId),
          caller: input.caller,
          to: input.to,
          amount: input.amount,
        },
        options,
      );
    } catch (error) {
      throw toFundableError(error, "Failed to withdraw from stream via Router.");
    }
  }

  async withdrawMax(
    input: Omit<RouterWithdrawInput, "amount">,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<bigint>> {
    assertStellarAddress(input.caller, "Caller");
    assertStellarAddress(input.to, "Withdrawal destination");
    try {
      return await this.client.withdraw_max(
        {
          token_id: toTokenId(input.tokenId),
          caller: input.caller,
          to: input.to,
        },
        options,
      );
    } catch (error) {
      throw toFundableError(error, "Failed to withdraw maximum from stream via Router.");
    }
  }

  private ensureStreamNftClient(): GeneratedStreamNftClient {
    if (!this.streamNftClient) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_CONFIGURATION,
        message:
          "Stream NFT contract address must be provided in client configuration to query NFT streams.",
        chain: "stellar",
      });
    }
    return this.streamNftClient;
  }

  async ownerOf(tokenId: string | bigint): Promise<string> {
    const nftClient = this.ensureStreamNftClient();
    try {
      const transaction = await nftClient.owner_of({ token_id: toTokenId(tokenId) });
      return transaction.result;
    } catch (error) {
      throw toFundableError(error, "Failed to load the current stream owner.", "stellar");
    }
  }

  private async getStreamData(
    tokenId: string | bigint,
  ): Promise<readonly [GeneratedStreamType, bigint]> {
    const nftClient = this.ensureStreamNftClient();
    try {
      const transaction = await nftClient.get_stream_data({
        token_id: toTokenId(tokenId),
      });
      return transaction.result;
    } catch (error) {
      throw toFundableError(error, "Failed to load stream data from NFT.", "stellar");
    }
  }

  async coreStreamId(tokenId: string | bigint): Promise<string> {
    const [, coreId] = await this.getStreamData(tokenId);
    return coreId.toString();
  }

  async statusOf(tokenId: string | bigint): Promise<CanonicalStreamStatus> {
    const [streamType, coreId] = await this.getStreamData(tokenId);
    try {
      if (streamType === GeneratedStreamType.Flow) {
        if (!this.flowClient) {
          throw new FundableError({
            code: FUNDABLE_ERROR_CODES.INVALID_CONFIGURATION,
            message:
              "Flow contract address must be provided in client configuration to query Flow status.",
            chain: "stellar",
          });
        }
        const tx = await this.flowClient.status_of({ stream_id: coreId });
        const status = CANONICAL_FLOW_STATUS[tx.result];
        if (!status) throw new Error(`Unknown Flow status: ${tx.result}`);
        return status;
      }

      if (streamType === GeneratedStreamType.Lockup) {
        if (!this.lockupClient) {
          throw new FundableError({
            code: FUNDABLE_ERROR_CODES.INVALID_CONFIGURATION,
            message:
              "Lockup contract address must be provided in client configuration to query Lockup status.",
            chain: "stellar",
          });
        }
        const tx = await this.lockupClient.status_of({ stream_id: coreId });
        const status = CANONICAL_LOCKUP_STATUS[tx.result];
        if (!status) throw new Error(`Unknown Lockup status: ${tx.result}`);
        return status;
      }

      throw new Error(`Unknown stream type: ${streamType}`);
    } catch (error) {
      throw toFundableError(error, "Failed to load the canonical stream status.", "stellar");
    }
  }

  async getStream(tokenId: string | bigint): Promise<StreamMetadata> {
    const id = toTokenId(tokenId);
    const [owner, [streamType, coreId], status] = await Promise.all([
      this.ownerOf(id),
      this.getStreamData(id),
      this.statusOf(id),
    ]);

    if (
      streamType !== GeneratedStreamType.Flow &&
      streamType !== GeneratedStreamType.Lockup
    ) {
      throw new Error(`Unknown stream type: ${streamType}`);
    }

    return {
      tokenId: id.toString(),
      coreStreamId: coreId.toString(),
      streamKind:
        streamType === GeneratedStreamType.Flow
          ? STREAM_KINDS.FLOW
          : STREAM_KINDS.LOCKUP,
      status,
      owner,
      transferable: true,
    };
  }

  async voidFlow(
    input: { tokenId: string | bigint; caller: string },
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.caller, "Caller");
    if (!this.flowClient) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_CONFIGURATION,
        message: "Flow contract address must be provided in client configuration.",
        chain: "stellar",
      });
    }
    const coreId = await this.coreStreamId(input.tokenId);
    try {
      return await this.flowClient.void_stream(
        { stream_id: toStreamId(coreId), caller: input.caller },
        options,
      );
    } catch (error) {
      throw toFundableError(error, "Failed to void Flow stream.");
    }
  }
}
