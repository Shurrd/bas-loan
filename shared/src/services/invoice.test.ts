import { describe, expect, it } from "vitest";
import { overdueDays, quoteInvoice, settleInvoice } from "./invoice";

describe("invoice shortfall example", () => {
    const face = 100_000_000n;

    it("quotes the advance, reserve and discount fee", () => {
        expect(quoteInvoice(face, 60)).toEqual({
            advance: 80_000_000n,
            reserve: 20_000_000n,
            fee: 4_734_247n,
        });
    });

    it("charges 160,000 kobo of penalty per day", () => {
        const settlement = settleInvoice(face, 60, "2025-03-01", "2025-03-02");
        expect(settlement.penalty).toBe(160_000n);
    });

    it("leaves the client owing 94,247 kobo at 96 days overdue", () => {
        const settlement = settleInvoice(face, 60, "2025-03-01", "2025-06-05");
        expect(settlement.overdueDays).toBe(96);
        expect(settlement.penalty).toBe(15_360_000n);
        expect(settlement.fee + settlement.penalty).toBe(20_094_247n);
        expect(settlement.shortfall).toBe(94_247n);
        expect(settlement.payableToClient).toBe(0n);
    });
});

describe("settleInvoice", () => {
    const face = 100_000_000n;

    it("pays the client the reserve less the fee when settled on time", () => {
        const settlement = settleInvoice(face, 60, "2025-03-01", "2025-03-01");
        expect(settlement.overdueDays).toBe(0);
        expect(settlement.penalty).toBe(0n);
        expect(settlement.payableToClient).toBe(20_000_000n - 4_734_247n);
        expect(settlement.shortfall).toBe(0n);
    });

    it("pays nothing and owes nothing when charges equal the reserve exactly", () => {
        // zero tenor, so no fee; 125 days x 160,000 = the whole reserve
        const settlement = settleInvoice(face, 0, "2025-03-01", "2025-07-04");
        expect(settlement.overdueDays).toBe(125);
        expect(settlement.penalty).toBe(20_000_000n);
        expect(settlement.payableToClient).toBe(0n);
        expect(settlement.shortfall).toBe(0n);
    });

    it("rounds the advance half-up before taking the fee", () => {
        const quote = quoteInvoice(1_234_567n, 30);
        expect(quote.advance).toBe(987_654n);
        expect(quote.reserve).toBe(246_913n);
        // fee is taken on the rounded advance: 987,654 * 0.36 * 30 / 365 = 29,223.99
        expect(quote.fee).toBe(29_224n);
    });

    it("does not count an early settlement as overdue", () => {
        expect(overdueDays("2025-03-10", "2025-03-01")).toBe(0);
    });

    it("rejects a non-positive face value", () => {
        expect(() => quoteInvoice(0n, 30)).toThrow();
    });
});
