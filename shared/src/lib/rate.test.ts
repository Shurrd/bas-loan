import { describe, expect, it } from "vitest";
import { monthlyRate, parseRate } from "./rate";

describe("rates", () => {
    it("parses decimal percentages into exact reduced fractions", () => {
        expect(parseRate("18.75")).toEqual({ numerator: 3n, denominator: 16n });
        expect(parseRate("0.5")).toEqual({ numerator: 1n, denominator: 200n });
        expect(parseRate("0")).toEqual({ numerator: 0n, denominator: 1n });
    });

    it("divides the annual rate by 12", () => {
        expect(monthlyRate(parseRate("18"))).toEqual({
            numerator: 3n,
            denominator: 200n,
        });
    });

    it("rejects malformed rates", () => {
        for (const bad of ["", "-5", "1.", ".5", "1e2", "18%"]) {
            expect(() => parseRate(bad)).toThrow();
        }
    });
});
