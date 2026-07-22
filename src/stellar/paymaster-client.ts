import {
  FUNDABLE_ERROR_CODES,
  FundableError,
  toFundableError,
  type PaymasterForwardInput,
} from "../core/index.js";
import { Client as GeneratedPaymasterClient } from "../generated/paymaster/src/index.js";
import type { StellarFundableClientConfig, StellarMethodOptions } from "./types.js";
import type { StellarTransaction } from "./flow-client.js";
import { assertPositive, assertStellarAddress } from "./validation.js";

export class StellarPaymasterClient {
  private readonly client: GeneratedPaymasterClient;

  constructor(config: StellarFundableClientConfig & { contracts: { paymaster: string } }) {
    this.client = new GeneratedPaymasterClient({
      contractId: config.contracts.paymaster,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      publicKey: config.publicKey,
      allowHttp: config.allowHttp,
      headers: config.headers,
      signTransaction: config.signTransaction,
      signAuthEntry: config.signAuthEntry,
    });
  }

  async isFeeTokenAllowed(token: string): Promise<boolean> {
    assertStellarAddress(token, "Fee token");
    try {
      const transaction = await this.client.is_fee_token_allowed({ token });
      return transaction.result;
    } catch (error) {
      throw toFundableError(error, "Failed to check the Paymaster fee token.", "stellar");
    }
  }

  async forward(
    input: PaymasterForwardInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<unknown>> {
    this.validateForwardInput(input);
    return this.client.forward(
      {
        user: input.user,
        fee_token: input.feeToken,
        fee_amount: input.feeAmount,
        max_fee_amount: input.maxFeeAmount,
        expiration_ledger: input.expirationLedger,
        fee_recipient: input.feeRecipient,
        target_contract: input.targetContract,
        function_name: input.functionName,
        args: [...input.args],
      },
      options,
    );
  }

  private validateForwardInput(input: PaymasterForwardInput): void {
    assertStellarAddress(input.user, "Paymaster user");
    assertStellarAddress(input.feeToken, "Fee token");
    assertStellarAddress(input.feeRecipient, "Fee recipient");
    assertStellarAddress(input.targetContract, "Target contract");
    assertPositive(input.feeAmount, "Fee amount");
    assertPositive(input.maxFeeAmount, "Maximum fee amount");
    if (input.feeAmount > input.maxFeeAmount) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "Fee amount cannot exceed the authorized maximum fee amount.",
        chain: "stellar",
      });
    }
    if (!Number.isInteger(input.expirationLedger) || input.expirationLedger < 0) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "Expiration ledger must be a non-negative integer.",
        chain: "stellar",
      });
    }
    if (!input.functionName.trim()) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "Target function name is required.",
        chain: "stellar",
      });
    }
  }
}
