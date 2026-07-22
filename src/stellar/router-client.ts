import type { CreateFlowInput, RouterWithdrawInput } from "../core/index.js";
import { toUnixSeconds } from "../core/index.js";
import { Client as GeneratedRouterClient } from "../generated/router/src/index.js";
import type { StellarFundableClientConfig, StellarMethodOptions } from "./types.js";
import type { StellarTransaction } from "./flow-client.js";
import {
  assertPositive,
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
