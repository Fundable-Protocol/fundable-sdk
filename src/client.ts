import { FUNDABLE_ERROR_CODES, FundableError } from "./core/index.js";
import {
  StellarFundableClient,
  type StellarFundableClientConfig,
} from "./stellar/index.js";

export type FundableClientConfig = StellarFundableClientConfig;

export function createFundableClient(
  config: StellarFundableClientConfig,
): StellarFundableClient {
  if (config.chain === "stellar") {
    return new StellarFundableClient(config);
  }

  throw new FundableError({
    code: FUNDABLE_ERROR_CODES.UNSUPPORTED_CHAIN,
    message: `Chain is not implemented by this SDK release.`,
  });
}
