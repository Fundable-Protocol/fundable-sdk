import { FUNDABLE_ERROR_CODES, FundableError } from "../core/index.js";
import { StellarFlowClient } from "./flow-client.js";
import { StellarPaymasterClient } from "./paymaster-client.js";
import { StellarRouterClient } from "./router-client.js";
import { StellarStreamNftClient } from "./stream-nft-client.js";
import type { StellarFundableClientConfig } from "./types.js";
import { assertContractId } from "./validation.js";

export class StellarFundableClient {
  readonly chain = "stellar" as const;
  readonly flows: StellarFlowClient;
  readonly router?: StellarRouterClient;
  readonly streamNft?: StellarStreamNftClient;
  readonly paymaster?: StellarPaymasterClient;

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

    if (config.contracts.router) {
      assertContractId(config.contracts.router, "Router contract");
      this.router = new StellarRouterClient({
        ...config,
        contracts: { ...config.contracts, router: config.contracts.router },
      });
    }
    if (config.contracts.streamNft) {
      assertContractId(config.contracts.streamNft, "Stream NFT contract");
      this.streamNft = new StellarStreamNftClient({
        ...config,
        contracts: { ...config.contracts, streamNft: config.contracts.streamNft },
      });
    }
    if (config.contracts.paymaster) {
      assertContractId(config.contracts.paymaster, "Paymaster contract");
      this.paymaster = new StellarPaymasterClient({
        ...config,
        contracts: { ...config.contracts, paymaster: config.contracts.paymaster },
      });
    }
  }
}
