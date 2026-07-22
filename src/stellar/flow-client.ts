import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import {
  CHAIN_FAMILIES,
  FLOW_STATUSES,
  toFundableError,
  toUnixSeconds,
  type AdjustFlowRateInput,
  type CreateAndDepositFlowInput,
  type CreateFlowInput,
  type DepositFlowInput,
  type FlowActorInput,
  type FlowRecord,
  type FlowStatus,
  type RestartFlowInput,
  type WithdrawFlowInput,
} from "../core/index.js";
import {
  Client as GeneratedFlowClient,
  StreamStatus as GeneratedStreamStatus,
  type FlowStream as GeneratedFlowStream,
} from "../generated/flow/src/index.js";
import type { StellarFundableClientConfig, StellarMethodOptions } from "./types.js";
import {
  assertPositive,
  assertStellarAddress,
  assertTokenDecimals,
  toStreamId,
} from "./validation.js";

export type StellarTransaction<TResult> = AssembledTransaction<TResult>;

const FLOW_STATUS_BY_CONTRACT_VALUE: Record<number, FlowStatus> = {
  [GeneratedStreamStatus.Pending]: FLOW_STATUSES.PENDING,
  [GeneratedStreamStatus.StreamingSolvent]: FLOW_STATUSES.STREAMING_SOLVENT,
  [GeneratedStreamStatus.StreamingInsolvent]: FLOW_STATUSES.STREAMING_INSOLVENT,
  [GeneratedStreamStatus.PausedSolvent]: FLOW_STATUSES.PAUSED_SOLVENT,
  [GeneratedStreamStatus.PausedInsolvent]: FLOW_STATUSES.PAUSED_INSOLVENT,
  [GeneratedStreamStatus.Voided]: FLOW_STATUSES.VOIDED,
};

export class StellarFlowClient {
  private readonly client: GeneratedFlowClient;

  constructor(config: StellarFundableClientConfig) {
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

  async create(
    input: CreateFlowInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<bigint>> {
    this.validateCreateInput(input);
    return this.client.create(
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
  }

  async createAndDeposit(
    input: CreateAndDepositFlowInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<bigint>> {
    this.validateCreateInput(input);
    assertPositive(input.amount, "Deposit amount");
    return this.client.create_and_deposit(
      {
        sender: input.sender,
        recipient: input.recipient,
        token: input.token.address,
        rate_per_second: input.ratePerSecond,
        token_decimals: input.token.decimals,
        start_time: toUnixSeconds(input.startTime),
        amount: input.amount,
      },
      options,
    );
  }

  async deposit(
    input: DepositFlowInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.funder, "Funder");
    assertPositive(input.amount, "Deposit amount");
    return this.client.deposit(
      {
        stream_id: toStreamId(input.streamId),
        funder: input.funder,
        amount: input.amount,
      },
      options,
    );
  }

  async withdraw(
    input: WithdrawFlowInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.caller, "Caller");
    assertStellarAddress(input.to, "Withdrawal destination");
    assertPositive(input.amount, "Withdrawal amount");
    return this.client.withdraw(
      {
        stream_id: toStreamId(input.streamId),
        caller: input.caller,
        to: input.to,
        amount: input.amount,
      },
      options,
    );
  }

  async withdrawMax(
    input: FlowActorInput & { to: string },
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<bigint>> {
    assertStellarAddress(input.actor, "Caller");
    assertStellarAddress(input.to, "Withdrawal destination");
    return this.client.withdraw_max(
      {
        stream_id: toStreamId(input.streamId),
        caller: input.actor,
        to: input.to,
      },
      options,
    );
  }

  async pause(
    input: FlowActorInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.actor, "Sender");
    return this.client.pause(
      {
        stream_id: toStreamId(input.streamId),
        sender: input.actor,
      },
      options,
    );
  }

  async restart(
    input: RestartFlowInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.actor, "Sender");
    assertPositive(input.ratePerSecond, "Rate per second");
    return this.client.restart(
      {
        stream_id: toStreamId(input.streamId),
        sender: input.actor,
        rate_per_second: input.ratePerSecond,
      },
      options,
    );
  }

  async adjustRate(
    input: AdjustFlowRateInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.actor, "Sender");
    assertPositive(input.ratePerSecond, "Rate per second");
    return this.client.adjust_rate(
      {
        stream_id: toStreamId(input.streamId),
        sender: input.actor,
        new_rate: input.ratePerSecond,
      },
      options,
    );
  }

  async refund(
    input: FlowActorInput & { amount: bigint },
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.actor, "Sender");
    assertPositive(input.amount, "Refund amount");
    return this.client.refund(
      {
        stream_id: toStreamId(input.streamId),
        sender: input.actor,
        amount: input.amount,
      },
      options,
    );
  }

  async refundMax(
    input: FlowActorInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<bigint>> {
    assertStellarAddress(input.actor, "Sender");
    return this.client.refund_max(
      {
        stream_id: toStreamId(input.streamId),
        sender: input.actor,
      },
      options,
    );
  }

  async void(
    input: FlowActorInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.actor, "Caller");
    return this.client.void_stream(
      {
        stream_id: toStreamId(input.streamId),
        caller: input.actor,
      },
      options,
    );
  }

  async getStream(streamId: string | bigint): Promise<FlowRecord> {
    const id = toStreamId(streamId);
    try {
      const { result } = await this.client.get_stream({ stream_id: id });
      return this.toFlowRecord(id, result);
    } catch (error) {
      throw toFundableError(error, "Failed to load Flow stream.", "stellar");
    }
  }

  async getStatus(streamId: string | bigint): Promise<FlowStatus> {
    try {
      const { result } = await this.client.status_of({
        stream_id: toStreamId(streamId),
      });
      const status = FLOW_STATUS_BY_CONTRACT_VALUE[result];
      if (!status) {
        throw new Error(`Unknown Flow status: ${result}`);
      }
      return status;
    } catch (error) {
      throw toFundableError(error, "Failed to load Flow status.", "stellar");
    }
  }

  async getBalance(streamId: string | bigint): Promise<bigint> {
    return this.readAmount("get_balance", streamId);
  }

  async getRatePerSecond(streamId: string | bigint): Promise<bigint> {
    return this.readAmount("get_rate_per_second", streamId);
  }

  async getWithdrawableAmount(streamId: string | bigint): Promise<bigint> {
    return this.readAmount("withdrawable_amount_of", streamId);
  }

  async getRefundableAmount(streamId: string | bigint): Promise<bigint> {
    return this.readAmount("refundable_amount_of", streamId);
  }

  async getTotalDebt(streamId: string | bigint): Promise<bigint> {
    return this.readAmount("total_debt_of", streamId);
  }

  async getCoveredDebt(streamId: string | bigint): Promise<bigint> {
    return this.readAmount("covered_debt_of", streamId);
  }

  async getUncoveredDebt(streamId: string | bigint): Promise<bigint> {
    return this.readAmount("uncovered_debt_of", streamId);
  }

  async getDepletionTime(streamId: string | bigint): Promise<bigint> {
    return this.readAmount("depletion_time_of", streamId);
  }

  private validateCreateInput(input: CreateFlowInput): void {
    assertStellarAddress(input.sender, "Sender");
    assertStellarAddress(input.recipient, "Recipient");
    assertStellarAddress(input.token.address, "Token");
    assertPositive(input.ratePerSecond, "Rate per second");
    assertTokenDecimals(input.token.decimals, "Flow token decimals");
  }

  private async readAmount(
    method:
      | "get_balance"
      | "get_rate_per_second"
      | "withdrawable_amount_of"
      | "refundable_amount_of"
      | "total_debt_of"
      | "covered_debt_of"
      | "uncovered_debt_of"
      | "depletion_time_of",
    streamId: string | bigint,
  ): Promise<bigint> {
    try {
      const transaction = await this.client[method]({
        stream_id: toStreamId(streamId),
      });
      return transaction.result;
    } catch (error) {
      throw toFundableError(error, `Failed to execute ${method}.`, "stellar");
    }
  }

  private toFlowRecord(streamId: bigint, stream: GeneratedFlowStream): FlowRecord {
    return {
      id: streamId.toString(),
      chain: CHAIN_FAMILIES.STELLAR,
      balance: stream.balance,
      isVoided: stream.is_voided,
      ratePerSecond: stream.rate_per_second,
      recipient: stream.recipient,
      sender: stream.sender,
      snapshotDebtScaled: stream.snapshot_debt_scaled,
      snapshotTime: stream.snapshot_time,
      token: {
        address: stream.token,
        decimals: stream.token_decimals,
      },
    };
  }
}
