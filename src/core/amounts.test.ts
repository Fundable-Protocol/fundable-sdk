import { describe, expect, it } from "vitest";
import { FundableError } from "./errors.js";
import { formatUnits, parseUnits, toUnixSeconds } from "./amounts.js";

describe("amount utilities", () => {
  it("parses and formats token units without floating-point precision loss", () => {
    const value = parseUnits("12345678901234567890.1234567", 7);

    expect(value).toBe(123456789012345678901234567n);
    expect(formatUnits(value, 7)).toBe("12345678901234567890.1234567");
  });

  it("preserves negative values", () => {
    expect(parseUnits("-1.25", 7)).toBe(-12_500_000n);
    expect(formatUnits(-12_500_000n, 7)).toBe("-1.25");
  });

  it("rejects precision that cannot be represented", () => {
    expect(() => parseUnits("1.001", 2)).toThrow(FundableError);
  });

  it("converts dates to Unix seconds", () => {
    expect(toUnixSeconds(new Date("2026-07-22T12:00:00.999Z"))).toBe(
      1_784_721_600n,
    );
  });
});
