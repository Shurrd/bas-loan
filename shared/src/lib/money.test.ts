import { describe, expect, it } from "vitest";
import { divHalfUp, formatKobo, formatNaira, parseNaira } from "./money";

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

describe("parseNaira", () => {
    it("reads naira strings into kobo without a float", () => {
        expect(parseNaira("1200000")).toBe(120_000_000n);
        expect(parseNaira("1,200,000.50")).toBe(120_000_050n);
        expect(parseNaira("0.05")).toBe(5n);
        expect(parseNaira("10.5")).toBe(1_050n);
        expect(parseNaira(" 5000000000.00 ")).toBe(500_000_000_000n);
    });

    it("rejects more than 2 decimal places and malformed input", () => {
        for (const bad of [
            "1.234",
            "1.001",
            "",
            ".5",
            "1.",
            "-5",
            "1e3",
            "12,34",
            "₦100",
            "1,2000",
        ]) {
            expect(parseNaira(bad)).toBeNull();
        }
    });
});

describe("formatNaira", () => {
    it("groups thousands and always shows two decimals", () => {
        expect(formatNaira(120_000_000n)).toBe("₦1,200,000.00");
        expect(formatNaira(5n)).toBe("₦0.05");
        expect(formatNaira(94_247n)).toBe("₦942.47");
        expect(formatNaira(500_000_000_000n)).toBe("₦5,000,000,000.00");
        expect(formatNaira(-1_050n)).toBe("-₦10.50");
    });
});

describe("formatKobo", () => {
    it("groups thousands and keeps the sign", () => {
        expect(formatKobo(94_247n)).toBe("94,247 kobo");
        expect(formatKobo(0n)).toBe("0 kobo");
        expect(formatKobo(-19_263_026n)).toBe("-19,263,026 kobo");
    });
});
