import { FUNDABLE_ERROR_CODES, FundableError } from "./errors.js";

const DECIMAL_AMOUNT_PATTERN = /^([+-]?)(\d+)(?:\.(\d*))?$/;

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new FundableError({
      code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
      message: "Token decimals must be an integer between 0 and 255.",
    });
  }
}

export function parseUnits(value: string, decimals: number): bigint {
  assertDecimals(decimals);
  const normalized = value.trim();
  const match = DECIMAL_AMOUNT_PATTERN.exec(normalized);

  if (!match) {
    throw new FundableError({
      code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
      message: `Invalid decimal amount: ${value}`,
    });
  }

  const [, sign, whole, fraction = ""] = match;
  if (fraction.length > decimals) {
    throw new FundableError({
      code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
      message: `Amount has more than ${decimals} decimal places.`,
    });
  }

  const scale = 10n ** BigInt(decimals);
  const fractionValue = fraction
    ? BigInt(fraction.padEnd(decimals, "0"))
    : 0n;
  const result = BigInt(whole) * scale + fractionValue;
  return sign === "-" ? -result : result;
}

export function formatUnits(value: bigint, decimals: number): string {
  assertDecimals(decimals);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  const fraction = (absolute % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function toUnixSeconds(value?: bigint | Date): bigint {
  if (value === undefined) {
    return 0n;
  }
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
        message: "Start time cannot be negative.",
      });
    }
    return value;
  }

  const milliseconds = value.getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new FundableError({
      code: FUNDABLE_ERROR_CODES.INVALID_ARGUMENT,
      message: "Start time must be a valid date.",
    });
  }
  return BigInt(Math.floor(milliseconds / 1_000));
}
