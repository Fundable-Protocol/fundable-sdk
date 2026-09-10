import { FUNDABLE_ERROR_CODES, FundableError } from "../core/index.js";
import { StellarFlowClient } from "./flow-client.js";
import { StellarLockupClient } from "./lockup-client.js";
import { StellarPaymasterClient } from "./paymaster-client.js";
import { StellarRouterClient } from "./router-client.js";
import { StellarStreamNftClient } from "./stream-nft-client.js";
import { StellarSponsorshipClient } from "./sponsorship-client.js";
import type { StellarSponsorBuild } from "./sponsorship-client.js";
import type { StellarFundableClientConfig } from "./types.js";
import { assertContractId } from "./validation.js";

export class StellarFundableClient {
  readonly chain = "stellar" as const;
  readonly flows: StellarFlowClient;
  readonly lockups?: StellarLockupClient;
  readonly router?: StellarRouterClient;
  readonly streamNft?: StellarStreamNftClient;
  /** @deprecated Production integrations must use `sponsorship`. */
  readonly paymaster?: StellarPaymasterClient;
  readonly sponsorship?: StellarSponsorshipClient;

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

    if (config.contracts.lockup) {
      assertContractId(config.contracts.lockup, "Lockup contract");
      this.lockups = new StellarLockupClient({
        ...config,
        contracts: { ...config.contracts, lockup: config.contracts.lockup },
      });
    }

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
    if (config.sponsorship) {
      this.sponsorship = new StellarSponsorshipClient(config.sponsorship);
    }
  }

  async signSponsorshipAuthorization(build: StellarSponsorBuild): Promise<string> {
    if (!this.sponsorship) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.UNSUPPORTED_CAPABILITY,
        message: "Stellar sponsorship is not configured.",
        chain: "stellar",
      });
    }
    if (this.sponsorship.isBuildExpired(build)) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.AUTHORIZATION_EXPIRED,
        message: "The sponsorship authorization has expired. Build it again before signing.",
        chain: "stellar",
      });
    }
    if (!this.config.signAuthEntry) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.UNSUPPORTED_CAPABILITY,
        message: "A wallet authorization-entry signer is required.",
        chain: "stellar",
      });
    }
    const result = await this.config.signAuthEntry(build.userAuthEntry, {
      networkPassphrase: this.config.networkPassphrase,
      address: this.config.publicKey,
    });
    if (result.error || !result.signedAuthEntry) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.TRANSACTION_FAILED,
        message: result.error?.message ?? "The wallet did not sign the authorization entry.",
        chain: "stellar",
      });
    }
    return result.signedAuthEntry;
  }
}
