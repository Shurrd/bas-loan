import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, isValidDate } from "./dates";
import { divHalfUp, parseKobo } from "./money";
import { monthlyRate, parseRate } from "./rate";

describe("divHalfUp", () => {
  it("rounds exact halves up and anything below down", () => {
    expect(divHalfUp(5n, 2n)).toBe(3n);
    expect(divHalfUp(4n, 3n)).toBe(1n);
    expect(divHalfUp(7n, 3n)).toBe(2n);
    expect(divHalfUp(10n, 4n)).toBe(3n);
    expect(divHalfUp(0n, 7n)).toBe(0n);
  });

  it("stays exact beyond the safe integer range", () => {
    const big = 10n ** 30n;
    expect(divHalfUp(big * 2n + 1n, 2n)).toBe(big + 1n);
    expect(divHalfUp(big * 2n - 1n, 2n)).toBe(big);
  });
});

describe("parseKobo", () => {
  it("accepts digit strings only", () => {
    expect(parseKobo("120000000")).toBe(120_000_000n);
    for (const bad of ["", "-1", "1.5", "1e3", " 1", "abc"]) {
      expect(() => parseKobo(bad)).toThrow();
    }
  });
});

describe("rates", () => {
  it("parses decimal percentages into exact reduced fractions", () => {
    expect(parseRate("18.75")).toEqual({ numerator: 3n, denominator: 16n });
    expect(parseRate("0.5")).toEqual({ numerator: 1n, denominator: 200n });
    expect(parseRate("0")).toEqual({ numerator: 0n, denominator: 1n });
  });

  it("divides the annual rate by 12", () => {
    expect(monthlyRate(parseRate("18"))).toEqual({ numerator: 3n, denominator: 200n });
  });

  it("rejects malformed rates", () => {
    for (const bad of ["", "-5", "1.", ".5", "1e2", "18%"]) {
      expect(() => parseRate(bad)).toThrow();
    }
  });
});

describe("dates", () => {
  it("counts calendar days across month, year and leap boundaries", () => {
    expect(daysBetween("2025-03-01", "2025-03-01")).toBe(0);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
    expect(daysBetween("2025-02-28", "2025-03-01")).toBe(1);
    expect(daysBetween("2024-12-31", "2025-01-01")).toBe(1);
    expect(daysBetween("2025-03-10", "2025-03-01")).toBe(-9);
  });

  it("adds months and clamps to month end", () => {
    expect(addMonths("2025-01-31", 1)).toBe("2025-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2025-11-30", 3)).toBe("2026-02-28");
    expect(addMonths("2025-12-15", 1)).toBe("2026-01-15");
    expect(addMonths("2025-01-15", 60)).toBe("2030-01-15");
  });

  it("rejects impossible and malformed dates", () => {
    expect(isValidDate("2025-02-29")).toBe(false);
    expect(isValidDate("2025-13-01")).toBe(false);
    expect(isValidDate("2025-1-01")).toBe(false);
    expect(isValidDate("2024-02-29")).toBe(true);
  });
});
