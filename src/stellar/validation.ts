import { Address, StrKey } from "@stellar/stellar-sdk";
import { FUNDABLE_ERROR_CODES, FundableError } from "../core/index.js";

export function assertStellarAddress(value: string, label: string): void {
  try {
    Address.fromString(value);
  } catch (cause) {
    throw new FundableError({
      code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
      message: `${label} must be a valid Stellar account or contract address.`,
      chain: "stellar",
      cause,
    });
  }
}

export function assertContractId(value: string, label: string): void {
  if (!StrKey.isValidContract(value)) {
    throw new FundableError({
      code: FUNDABLE_ERROR_CODES.INVALID_CONFIGURATION,
      message: `${label} must be a valid Stellar contract ID.`,
      chain: "stellar",
    });
  }
}

export function toStreamId(value: string | bigint): bigint {
  let streamId: bigint;
  try {
    streamId = typeof value === "bigint" ? value : BigInt(value);
  } catch (cause) {
    throw new FundableError({
      code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
      message: "Stream ID must be a non-negative integer.",
      chain: "stellar",
      cause,
    });
  }

  if (streamId < 0n) {
    throw new FundableError({
      code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
      message: "Stream ID must be a non-negative integer.",
      chain: "stellar",
    });
  }
  return streamId;
}

export function assertPositive(value: bigint, label: string): void {
  if (value <= 0n) {
    throw new FundableError({
      code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
      message: `${label} must be greater than zero.`,
      chain: "stellar",
    });
  }
}
