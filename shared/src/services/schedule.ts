import { addMonths } from "../lib/date";
import { divHalfUp } from "../lib/money";
import { monthlyRate, parseRate } from "../lib/rate";
import type { Instalment, LoanTerms } from "../types/loan";
import type { Fraction } from "../types/money";

// With i = a/b: P*i / (1 - (1+i)^-n) = P*a*(a+b)^n / (b*((a+b)^n - b^n))
export const instalmentAmount = (
    principal: bigint,
    rate: Fraction,
    termMonths: number
) => {
    const { numerator: a, denominator: b } = rate;
    const n = BigInt(termMonths);
    if (a === 0n) return divHalfUp(principal, n);

    const growth = (a + b) ** n;
    return divHalfUp(principal * a * growth, b * (growth - b ** n));
};

export const buildSchedule = (terms: LoanTerms) => {
    const { principal, termMonths, disbursementDate } = terms;
    if (principal <= 0n) throw new RangeError("Principal must be positive");
    if (!Number.isInteger(termMonths) || termMonths < 1) {
        throw new RangeError("Term must be a whole number of months");
    }

    const rate = monthlyRate(parseRate(terms.annualRatePercent));
    const regular = instalmentAmount(principal, rate, termMonths);
    const schedule: Instalment[] = [];
    let balance = principal;

    for (let number = 1; number <= termMonths; number++) {
        const interest = divHalfUp(balance * rate.numerator, rate.denominator);
        const principalPaid = number === termMonths ? balance : regular - interest;
        balance -= principalPaid;
        schedule.push({
            number,
            dueDate: addMonths(disbursementDate, number),
            payment: principalPaid + interest,
            interest,
            principal: principalPaid,
            closingBalance: balance,
        });
    }
    return schedule;
};
