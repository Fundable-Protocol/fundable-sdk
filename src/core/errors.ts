import type { ChainFamily } from "./types.js";

export const FUNDABLE_ERROR_CODES = {
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  INVALID_CONFIGURATION: "INVALID_CONFIGURATION",
  UNSUPPORTED_CHAIN: "UNSUPPORTED_CHAIN",
  UNSUPPORTED_CAPABILITY: "UNSUPPORTED_CAPABILITY",
  SIMULATION_FAILED: "SIMULATION_FAILED",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
  RPC_UNAVAILABLE: "RPC_UNAVAILABLE",
} as const;

export type FundableErrorCode =
  (typeof FUNDABLE_ERROR_CODES)[keyof typeof FUNDABLE_ERROR_CODES];

export class FundableError extends Error {
  readonly code: FundableErrorCode;
  readonly chain?: ChainFamily;
  readonly cause?: unknown;

  constructor(params: {
    code: FundableErrorCode;
    message: string;
    chain?: ChainFamily;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "FundableError";
    this.code = params.code;
    this.chain = params.chain;
    this.cause = params.cause;
  }
}

export function toFundableError(
  error: unknown,
  fallbackMessage: string,
  chain?: ChainFamily,
): FundableError {
  if (error instanceof FundableError) {
    return error;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return new FundableError({
    code: FUNDABLE_ERROR_CODES.SIMULATION_FAILED,
    message: message || fallbackMessage,
    chain,
    cause: error,
  });
}
