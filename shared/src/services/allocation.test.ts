import { describe, expect, it } from "vitest";
import { allocatePayment } from "./allocation";
import { buildSchedule } from "./schedule";

// Worked Example 1: instalment 21,063,026 due on the 15th of Feb to Jul 2025
const fresh = () =>
    buildSchedule({
        principal: 120_000_000n,
        annualRatePercent: "18",
        termMonths: 6,
        disbursementDate: "2025-01-15",
    }).map((row) => ({
        ...row,
        penaltyDue: 0n,
        feeDue: 0n,
        interestPaid: 0n,
        principalPaid: 0n,
        penaltyPaid: 0n,
        feePaid: 0n,
    }));

describe("allocatePayment", () => {
    it("stops inside interest on a small partial payment", () => {
        const result = allocatePayment(fresh(), 500_000n, "2025-02-15");
        expect(result).toEqual({
            received: 500_000n,
            lines: [
                { number: 1, penalty: 0n, fee: 0n, interest: 500_000n, principal: 0n },
            ],
            penalty: 0n,
            fee: 0n,
            interest: 500_000n,
            principal: 0n,
            unapplied: 0n,
        });
    });

    it("stops inside principal once interest is cleared", () => {
        const result = allocatePayment(fresh(), 2_000_000n, "2025-02-15");
        expect(result.lines).toEqual([
            {
                number: 1,
                penalty: 0n,
                fee: 0n,
                interest: 1_800_000n,
                principal: 200_000n,
            },
        ]);
        expect(result.unapplied).toBe(0n);
    });

    it("clears the exact instalment with nothing left over", () => {
        const result = allocatePayment(fresh(), 21_063_026n, "2025-02-15");
        expect(result.interest).toBe(1_800_000n);
        expect(result.principal).toBe(19_263_026n);
        expect(result.unapplied).toBe(0n);
    });

    it("pays several overdue instalments oldest first", () => {
        const result = allocatePayment(fresh(), 50_000_000n, "2025-04-15");
        expect(result.lines).toEqual([
            {
                number: 1,
                penalty: 0n,
                fee: 0n,
                interest: 1_800_000n,
                principal: 19_263_026n,
            },
            {
                number: 2,
                penalty: 0n,
                fee: 0n,
                interest: 1_511_055n,
                principal: 19_551_971n,
            },
            {
                number: 3,
                penalty: 0n,
                fee: 0n,
                interest: 1_217_775n,
                principal: 6_656_173n,
            },
        ]);
        expect(result.unapplied).toBe(0n);
    });

    it("sends the surplus to unapplied credit and leaves later instalments alone", () => {
        const result = allocatePayment(fresh(), 30_000_000n, "2025-02-15");
        expect(result.lines.map((line) => line.number)).toEqual([1]);
        expect(result.principal).toBe(19_263_026n);
        expect(result.unapplied).toBe(8_936_974n);
    });

    it("puts everything in unapplied credit when nothing is due yet", () => {
        const result = allocatePayment(fresh(), 1_000_000n, "2025-01-20");
        expect(result.lines).toEqual([]);
        expect(result.unapplied).toBe(1_000_000n);
    });

    it("sends an overpayment on the last instalment to unapplied credit", () => {
        const result = allocatePayment(fresh(), 126_378_154n + 1_000_000n, "2025-07-15");
        expect(result.lines).toHaveLength(6);
        expect(result.principal).toBe(120_000_000n);
        expect(result.interest).toBe(6_378_154n);
        expect(result.unapplied).toBe(1_000_000n);
    });

    it("skips instalments that are already paid", () => {
        const schedule = fresh();
        schedule[0] = {
            ...schedule[0]!,
            interestPaid: 1_800_000n,
            principalPaid: 19_263_026n,
        };
        const result = allocatePayment(schedule, 1_000n, "2025-03-15");
        expect(result.lines).toEqual([
            { number: 2, penalty: 0n, fee: 0n, interest: 1_000n, principal: 0n },
        ]);
    });

    it("continues from a part-paid instalment", () => {
        const schedule = fresh();
        schedule[0] = {
            ...schedule[0]!,
            interestPaid: 1_800_000n,
            principalPaid: 100_000n,
        };
        const result = allocatePayment(schedule, 200_000n, "2025-02-15");
        expect(result.lines).toEqual([
            { number: 1, penalty: 0n, fee: 0n, interest: 0n, principal: 200_000n },
        ]);
    });

    it("takes penalty, then fee, then interest, then principal inside an instalment", () => {
        const schedule = fresh();
        schedule[0] = { ...schedule[0]!, penaltyDue: 1_000n, feeDue: 2_000n };
        expect(allocatePayment(schedule, 1_500n, "2025-02-15").lines).toEqual([
            { number: 1, penalty: 1_000n, fee: 500n, interest: 0n, principal: 0n },
        ]);
        expect(allocatePayment(schedule, 4_000n, "2025-02-15").lines).toEqual([
            { number: 1, penalty: 1_000n, fee: 2_000n, interest: 1_000n, principal: 0n },
        ]);
    });

    it("finishes an older instalment before touching a newer one", () => {
        const schedule = fresh();
        schedule[1] = { ...schedule[1]!, penaltyDue: 5_000n };
        const result = allocatePayment(schedule, 21_063_026n + 100n, "2025-03-15");
        expect(result.lines).toEqual([
            {
                number: 1,
                penalty: 0n,
                fee: 0n,
                interest: 1_800_000n,
                principal: 19_263_026n,
            },
            { number: 2, penalty: 100n, fee: 0n, interest: 0n, principal: 0n },
        ]);
    });

    it("rejects a payment of zero or less", () => {
        expect(() => allocatePayment(fresh(), 0n, "2025-02-15")).toThrow();
        expect(() => allocatePayment(fresh(), -5n, "2025-02-15")).toThrow();
    });

    it("never allocates more than was received, whatever the amount and date", () => {
        const dates = [
            "2025-01-15",
            "2025-02-15",
            "2025-04-20",
            "2025-07-15",
            "2026-01-01",
        ];
        for (let amount = 1n; amount < 200_000_000n; amount = amount * 3n + 7n) {
            for (const date of dates) {
                const result = allocatePayment(fresh(), amount, date);
                const allocated =
                    result.penalty + result.fee + result.interest + result.principal;
                expect(allocated + result.unapplied).toBe(amount);
                expect(result.unapplied >= 0n).toBe(true);
            }
        }
    });
});
