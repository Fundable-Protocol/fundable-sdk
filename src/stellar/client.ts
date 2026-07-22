import { FUNDABLE_ERROR_CODES, FundableError } from "../core/index.js";
import { StellarFlowClient } from "./flow-client.js";
import type { StellarFundableClientConfig } from "./types.js";
import { assertContractId } from "./validation.js";

export class StellarFundableClient {
  readonly chain = "stellar" as const;
  readonly flows: StellarFlowClient;

  constructor(readonly config: StellarFundableClientConfig) {
    if (!config.rpcUrl || !config.networkPassphrase) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_CONFIGURATION,
        message: "Stellar RPC URL and network passphrase are required.",
        chain: "stellar",
      });
    }
    assertContractId(config.contracts.flow, "Flow contract");
    this.flows = new StellarFlowClient(config);
  }
}
