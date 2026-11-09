import { describe, expect, it } from "vitest";
import { divHalfUp, parseKobo } from "./money";

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
