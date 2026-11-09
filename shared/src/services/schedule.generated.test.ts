import { describe, expect, it } from "vitest";
import { addMonths } from "../lib/date";
import { parseRate } from "../lib/rate";
import type { LoanTerms } from "../types/loan";
import { buildSchedule } from "./schedule";

function mulberry32(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const MIN_PRINCIPAL = 100_000n; // ₦1,000
const MAX_PRINCIPAL = 500_000_000_000n; // ₦5bn

function randomBigInt(random: () => number, min: bigint, max: bigint): bigint {
    const span = max - min + 1n;
    const bits =
        (BigInt(Math.floor(random() * 2 ** 32)) << 32n) |
        BigInt(Math.floor(random() * 2 ** 32));
    return min + (bits % span);
}

// Rates from 0.5 to 60 with 0 to 3 decimals, built from integers so no float touches a rate
function randomRate(random: () => number): string {
    const decimals = Math.floor(random() * 4);
    const min = decimals === 0 ? 1n : 5n * 10n ** BigInt(decimals - 1);
    const max = 60n * 10n ** BigInt(decimals);
    const text = randomBigInt(random, min, max).toString();
    if (decimals === 0) return text;
    const padded = text.padStart(decimals + 1, "0");
    return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`;
}

function generateCases(count: number): LoanTerms[] {
    const random = mulberry32(20250115);
    const corners: LoanTerms[] = [];
    for (const principal of [MIN_PRINCIPAL, MAX_PRINCIPAL]) {
        for (const annualRatePercent of ["0.5", "60"]) {
            for (const termMonths of [1, 60]) {
                corners.push({
                    principal,
                    annualRatePercent,
                    termMonths,
                    disbursementDate: "2025-01-31",
                });
            }
        }
    }
    const generated = Array.from({ length: count - corners.length }, (): LoanTerms => {
        const day = 1 + Math.floor(random() * 28);
        const month = 1 + Math.floor(random() * 12);
        return {
            principal: randomBigInt(random, MIN_PRINCIPAL, MAX_PRINCIPAL),
            annualRatePercent: randomRate(random),
            termMonths: 1 + Math.floor(random() * 60),
            disbursementDate: `${2024 + Math.floor(random() * 3)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        };
    });
    return [...corners, ...generated];
}

// Reference: 10^-100 fixed point, power by repeated multiplication, rate read from the string.
// Shares no code or formula shape with the real implementation.
const SCALE = 10n ** 100n;

function scaledPercent(percent: string): bigint {
    const [whole = "0", fraction = ""] = percent.split(".");
    const digits = whole + fraction;
    return (BigInt(digits) * SCALE) / (100n * 10n ** BigInt(fraction.length));
}

function referenceInstalment(terms: LoanTerms): {
    value: bigint;
    distanceFromHalf: bigint;
} {
    const monthly = scaledPercent(terms.annualRatePercent) / 12n;
    const factor = SCALE + monthly;
    let power = SCALE;
    for (let i = 0; i < terms.termMonths; i++) {
        power = (power * factor) / SCALE;
    }
    const exact = (terms.principal * monthly * power) / (power - SCALE);
    const whole = exact / SCALE;
    const remainder = exact % SCALE;
    const half = SCALE / 2n;
    const value = remainder >= half ? whole + 1n : whole;
    const distance = remainder >= half ? remainder - half : half - remainder;
    return { value, distanceFromHalf: distance };
}

// 12 stays in the denominator: truncating rate/12 pushes exact half-kobo ties below the boundary
function referenceInterest(balance: bigint, annualRatePercent: string): bigint {
    const exact = balance * scaledPercent(annualRatePercent);
    const divisor = 12n * SCALE;
    const whole = exact / divisor;
    return exact % divisor >= divisor / 2n ? whole + 1n : whole;
}

const isInterestTie = (balance: bigint, annualRatePercent: string) => {
    const divisor = 12n * SCALE;
    return (balance * scaledPercent(annualRatePercent)) % divisor === divisor / 2n;
};

const cases = generateCases(300);

describe("generated term loan schedules", () => {
    it("covers at least 200 cases across the brief's ranges", () => {
        expect(cases.length).toBeGreaterThanOrEqual(200);
        for (const c of cases) {
            expect(c.principal >= MIN_PRINCIPAL && c.principal <= MAX_PRINCIPAL).toBe(
                true
            );
            const rate = parseRate(c.annualRatePercent);
            expect(rate.numerator * 200n >= rate.denominator).toBe(true); // at least 0.5%
            expect(rate.numerator * 5n <= rate.denominator * 3n).toBe(true); // at most 60%
            expect(c.termMonths).toBeGreaterThanOrEqual(1);
            expect(c.termMonths).toBeLessThanOrEqual(60);
        }
    });

    it("includes exact half-kobo interest ties", () => {
        let ties = 0;
        let casesWithTies = 0;
        for (const terms of cases) {
            let opening = terms.principal;
            let found = 0;
            for (const row of buildSchedule(terms)) {
                if (isInterestTie(opening, terms.annualRatePercent)) found++;
                opening = row.closingBalance;
            }
            ties += found;
            if (found > 0) casesWithTies++;
        }
        console.log(
            `exact half-kobo interest ties: ${ties} rows in ${casesWithTies} cases`
        );
        expect(ties).toBeGreaterThan(0);
    });

    it.each(cases.map((c, index) => [index, c] as const))(
        "case %i keeps the schedule invariants",
        (_index, terms) => {
            const schedule = buildSchedule(terms);
            const last = schedule[schedule.length - 1]!;

            expect(schedule).toHaveLength(terms.termMonths);
            expect(schedule.reduce((sum, row) => sum + row.principal, 0n)).toBe(
                terms.principal
            );
            expect(last.closingBalance).toBe(0n);

            let opening = terms.principal;
            schedule.forEach((row, i) => {
                expect(row.number).toBe(i + 1);
                expect(row.payment).toBe(row.principal + row.interest);
                expect(row.closingBalance).toBe(opening - row.principal);
                expect(row.closingBalance).toBeGreaterThanOrEqual(0n);
                expect(row.principal).toBeGreaterThan(0n);
                expect(row.dueDate).toBe(addMonths(terms.disbursementDate, i + 1));
                opening = row.closingBalance;
            });

            // Only the last instalment may differ. The gap reaches ~140 kobo on large, long, high-rate loans
            const regular = schedule[0]!.payment;
            if (schedule.length > 1) {
                for (const row of schedule.slice(0, -1)) {
                    expect(row.payment).toBe(regular);
                }
                const difference = last.payment - regular;
                expect(difference < 0n ? -difference : difference).toBeLessThanOrEqual(
                    500n
                );
            }
        }
    );

    it.each(cases.map((c, index) => [index, c] as const))(
        "case %i matches the high-precision reference",
        (_index, terms) => {
            const schedule = buildSchedule(terms);
            const reference = referenceInstalment(terms);

            // too close to a rounding boundary and the reference could not settle the comparison
            expect(reference.distanceFromHalf).toBeGreaterThan(SCALE / 10n ** 20n);
            expect(schedule[0]!.payment).toBe(reference.value);

            let balance = terms.principal;
            schedule.forEach((row, i) => {
                const interest = referenceInterest(balance, terms.annualRatePercent);
                expect(row.interest).toBe(interest);
                const isLast = i === schedule.length - 1;
                const principalPaid = isLast ? balance : reference.value - interest;
                expect(row.principal).toBe(principalPaid);
                balance -= principalPaid;
                expect(row.closingBalance).toBe(balance);
            });
        }
    );
});
