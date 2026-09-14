import { FUNDABLE_ERROR_CODES, FundableError } from "../core/index.js";

export interface SorobanContractErrorDefinition {
  code: number;
  contract: "flow" | "lockup" | "stream_nft" | "router" | "paymaster";
  name: string;
  message: string;
}

export const SOROBAN_CONTRACT_ERRORS: Record<number, SorobanContractErrorDefinition> = {
  // Flow Contract Errors (1-28)
  1: { code: 1, contract: "flow", name: "StreamNotFound", message: "Flow stream does not exist." },
  2: { code: 2, contract: "flow", name: "StreamAlreadyVoided", message: "Flow stream has already been voided." },
  3: { code: 3, contract: "flow", name: "StreamAlreadyDepleted", message: "Flow stream has already been depleted." },
  4: { code: 4, contract: "flow", name: "StreamPaused", message: "Flow stream is paused." },
  5: { code: 5, contract: "flow", name: "StreamNotPaused", message: "Flow stream is not paused." },
  6: { code: 6, contract: "flow", name: "StreamNotStreaming", message: "Flow stream is not in an active streaming state." },
  7: { code: 7, contract: "flow", name: "StreamNotPending", message: "Flow stream is not pending." },
  8: { code: 8, contract: "flow", name: "StreamNotDepleted", message: "Flow stream is not depleted." },
  9: { code: 9, contract: "flow", name: "InsufficientBalance", message: "Stream balance is insufficient for this withdrawal or refund." },
  10: { code: 10, contract: "flow", name: "AmountExceedsBalance", message: "Requested amount exceeds stream balance." },
  11: { code: 11, contract: "flow", name: "InvalidRate", message: "Flow rate per second must be greater than zero." },
  12: { code: 12, contract: "flow", name: "InvalidDepositAmount", message: "Deposit amount must be greater than zero." },
  13: { code: 13, contract: "flow", name: "InvalidWithdrawAmount", message: "Withdrawal amount must be greater than zero." },
  14: { code: 14, contract: "flow", name: "InvalidRefundAmount", message: "Refund amount must be greater than zero." },
  15: { code: 15, contract: "flow", name: "InvalidStartTime", message: "Start time must not be in the past." },
  16: { code: 16, contract: "flow", name: "AlreadyInitialized", message: "Flow contract has already been initialized." },
  17: { code: 17, contract: "flow", name: "NotInitialized", message: "Flow contract is not initialized." },
  18: { code: 18, contract: "flow", name: "NotAuthorized", message: "Caller is not authorized to perform this Flow action." },
  19: { code: 19, contract: "flow", name: "ZeroRateVoidedStream", message: "Cannot void a stream with zero rate." },
  20: { code: 20, contract: "flow", name: "SenderEqualsRecipient", message: "Sender and recipient addresses cannot be the same." },
  21: { code: 21, contract: "flow", name: "NegativeRate", message: "Rate per second must not be negative." },
  22: { code: 22, contract: "flow", name: "TokenTransferMismatch", message: "Token transfer resulted in an unexpected balance change." },
  23: { code: 23, contract: "flow", name: "TokenDecimalsMismatch", message: "Token decimals mismatch: caller-supplied decimals do not match the token contract." },
  24: { code: 24, contract: "flow", name: "ArithmeticError", message: "Checked arithmetic operation failed (overflow or underflow)." },
  25: { code: 25, contract: "flow", name: "AdminTransferPending", message: "An admin transfer is already pending." },
  26: { code: 26, contract: "flow", name: "NoAdminTransferPending", message: "No admin transfer is pending to accept." },
  27: { code: 27, contract: "flow", name: "UpgradeTimelocked", message: "Contract upgrade is timelocked and cannot be executed yet." },
  28: { code: 28, contract: "flow", name: "NoUpgradeProposed", message: "No upgrade has been proposed." },

  // Lockup Contract Errors (101-120)
  101: { code: 101, contract: "lockup", name: "StreamNotFound", message: "Lockup stream does not exist." },
  102: { code: 102, contract: "lockup", name: "StreamNotCancelable", message: "Lockup stream is not cancelable." },
  103: { code: 103, contract: "lockup", name: "StreamAlreadyRenounced", message: "Lockup stream cancellation rights have already been renounced." },
  104: { code: 104, contract: "lockup", name: "InvalidTimeRange", message: "End time must be later than start time." },
  105: { code: 105, contract: "lockup", name: "InvalidCliffTime", message: "Cliff time must be between start time and end time." },
  106: { code: 106, contract: "lockup", name: "InvalidTotalAmount", message: "Total stream amount must be greater than zero." },
  107: { code: 107, contract: "lockup", name: "InvalidGranularity", message: "Granularity must be greater than zero." },
  108: { code: 108, contract: "lockup", name: "AlreadyInitialized", message: "Lockup contract has already been initialized." },
  109: { code: 109, contract: "lockup", name: "NotInitialized", message: "Lockup contract is not initialized." },
  110: { code: 110, contract: "lockup", name: "SenderEqualsRecipient", message: "Sender and recipient addresses cannot be the same." },
  111: { code: 111, contract: "lockup", name: "NegativeUnlockAmount", message: "Lockup unlock amounts (start or cliff) cannot be negative." },
  112: { code: 112, contract: "lockup", name: "UnlockSumOverflow", message: "Sum of start and cliff unlock amounts overflowed maximum integer capacity." },
  113: { code: 113, contract: "lockup", name: "InvalidUnlockSum", message: "Sum of start and cliff unlock amounts cannot exceed total stream amount." },
  114: { code: 114, contract: "lockup", name: "InvalidCancellationAmount", message: "Defensive cancellation amount validation failed." },
  115: { code: 115, contract: "lockup", name: "TokenTransferMismatch", message: "Token transfer resulted in an unexpected balance change." },
  116: { code: 116, contract: "lockup", name: "ArithmeticError", message: "Checked arithmetic operation failed (overflow or underflow)." },
  117: { code: 117, contract: "lockup", name: "AdminTransferPending", message: "An admin transfer is already pending." },
  118: { code: 118, contract: "lockup", name: "NoAdminTransferPending", message: "No admin transfer is pending to accept." },
  119: { code: 119, contract: "lockup", name: "UpgradeTimelocked", message: "Contract upgrade is timelocked and cannot be executed yet." },
  120: { code: 120, contract: "lockup", name: "NoUpgradeProposed", message: "No upgrade has been proposed." },

  // Stream NFT Errors (201-205)
  201: { code: 201, contract: "stream_nft", name: "AlreadyInitialized", message: "Stream NFT contract has already been initialized." },
  202: { code: 202, contract: "stream_nft", name: "NotAuthorized", message: "Caller is not authorized to perform this Stream NFT action." },
  203: { code: 203, contract: "stream_nft", name: "TokenNotFound", message: "Stream NFT token not found." },
  204: { code: 204, contract: "stream_nft", name: "NotTransferable", message: "Stream NFT is not transferable." },
  205: { code: 205, contract: "stream_nft", name: "AlreadyMinted", message: "Stream NFT token ID has already been minted." },

  // Router Contract Errors (301-305)
  301: { code: 301, contract: "router", name: "AlreadyInitialized", message: "Router contract has already been initialized." },
  302: { code: 302, contract: "router", name: "NotInitialized", message: "Router contract is not initialized." },
  303: { code: 303, contract: "router", name: "NotAuthorized", message: "Caller is not authorized to perform this Router action." },
  304: { code: 304, contract: "router", name: "InvalidStreamType", message: "Invalid stream type specified for Router operation." },
  305: { code: 305, contract: "router", name: "InvalidContractAddress", message: "A required contract address is invalid or unset on Router." },

  // Paymaster Contract Errors (401-408)
  401: { code: 401, contract: "paymaster", name: "AlreadyInitialized", message: "Paymaster contract has already been initialized." },
  402: { code: 402, contract: "paymaster", name: "NotInitialized", message: "Paymaster contract is not initialized." },
  403: { code: 403, contract: "paymaster", name: "NotAuthorized", message: "Caller is not authorized to perform this Paymaster action." },
  404: { code: 404, contract: "paymaster", name: "FeeTokenNotAllowed", message: "Fee token is not in the Paymaster allowlist." },
  405: { code: 405, contract: "paymaster", name: "FeeExceedsMaximum", message: "Requested fee exceeds authorized maximum fee." },
  406: { code: 406, contract: "paymaster", name: "ApprovalExpired", message: "Fee authorization has expired." },
  407: { code: 407, contract: "paymaster", name: "CallFailed", message: "Forwarded contract call failed." },
  408: { code: 408, contract: "paymaster", name: "InvalidFeeRecipient", message: "Invalid fee recipient address." },
};

/**
 * Extracts a numeric Soroban contract error code from an error or error message string.
 * Supports patterns such as:
 * - `Error(Contract, #111)`
 * - `Error(Contract, 111)`
 * - `HostError: Error(Contract, #113)`
 * - `ContractError(#111)` or `ContractError: 111`
 */
export function parseSorobanErrorCode(error: unknown): number | undefined {
  if (error === null || error === undefined) return undefined;

  // Direct error code property
  if (typeof error === "object") {
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.contractCode === "number") {
      return errorObj.contractCode;
    }
    if (typeof errorObj.code === "number" && errorObj.code in SOROBAN_CONTRACT_ERRORS) {
      return errorObj.code;
    }
  }

  const message =
    error instanceof Error
      ? `${error.message} ${"cause" in error && error.cause instanceof Error ? error.cause.message : ""}`
      : String(error);

  const patterns = [
    /Error\(Contract,\s*#?(\d+)\)/i,
    /ContractError\s*[:(]\s*#?(\d+)\)?/i,
    /contract\s+error\s*[:#]\s*(\d+)/i,
    /HostError.*Error\(Contract,\s*#?(\d+)\)/i,
    /\bcode\s*[:=]\s*#?(\d+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const code = parseInt(match[1], 10);
      if (Number.isInteger(code) && code in SOROBAN_CONTRACT_ERRORS) {
        return code;
      }
    }
  }

  return undefined;
}

/**
 * Translates an unknown error (typically from a Soroban simulation or RPC invocation)
 * into a descriptive FundableError if it matches a known Soroban contract error.
 */
export function translateSorobanError(
  error: unknown,
  fallbackMessage: string,
): FundableError {
  if (error instanceof FundableError) {
    return error;
  }

  const code = parseSorobanErrorCode(error);
  if (code !== undefined) {
    const def = SOROBAN_CONTRACT_ERRORS[code];
    if (def) {
      return new FundableError({
        code: FUNDABLE_ERROR_CODES.SIMULATION_FAILED,
        message: `${def.message} [${def.contract.toUpperCase()} error ${def.code}: ${def.name}]`,
        chain: "stellar",
        cause: error,
      });
    }
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  return new FundableError({
    code: FUNDABLE_ERROR_CODES.SIMULATION_FAILED,
    message: rawMessage || fallbackMessage,
    chain: "stellar",
    cause: error,
  });
}

/**
 * Standard error translation helper for Stellar Soroban contract calls.
 */
export function toFundableError(
  error: unknown,
  fallbackMessage: string,
  chain: "stellar" = "stellar",
): FundableError {
  if (error instanceof FundableError) {
    return error;
  }
  return translateSorobanError(error, fallbackMessage);
}
