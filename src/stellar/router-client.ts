import {
  FUNDABLE_ERROR_CODES,
  FundableError,
  toUnixSeconds,
  type CreateFlowInput,
  type CreateLockupInput,
  type RouterWithdrawInput,
} from "../core/index.js";
import { Client as GeneratedRouterClient } from "../generated/router/src/index.js";
import type { StellarFundableClientConfig, StellarMethodOptions } from "./types.js";
import type { StellarTransaction } from "./flow-client.js";
import {
  assertPositive,
  assertNonNegative,
  assertStellarAddress,
  assertTokenDecimals,
  toTokenId,
} from "./validation.js";

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
}
