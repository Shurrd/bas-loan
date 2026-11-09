import { daysBetween } from "../lib/date";
import type { Allocation, InstalmentAllocation } from "../types/allocation";
import type { InstalmentState } from "../types/loan";

type Due = Pick<
    InstalmentState,
    | "number"
    | "dueDate"
    | "penaltyDue"
    | "penaltyPaid"
    | "feeDue"
    | "feePaid"
    | "interest"
    | "interestPaid"
    | "principal"
    | "principalPaid"
>;

// Oldest due instalment first; inside one: penalty, fee, interest, principal.
// Instalments not due by the payment date are untouched. What is left is unapplied credit.
export const allocatePayment = (
    instalments: Due[],
    amount: bigint,
    paymentDate: string
): Allocation => {
    if (amount <= 0n) throw new RangeError("Payment must be greater than zero");

    let remaining = amount;
    const take = (outstanding: bigint) => {
        const part = remaining < outstanding ? remaining : outstanding;
        remaining -= part;
        return part;
    };

    const lines: InstalmentAllocation[] = [];
    const total = { penalty: 0n, fee: 0n, interest: 0n, principal: 0n };

    const due = instalments
        .filter((item) => daysBetween(item.dueDate, paymentDate) >= 0)
        .sort((a, b) => a.number - b.number);

    for (const item of due) {
        const penalty = take(item.penaltyDue - item.penaltyPaid);
        const fee = take(item.feeDue - item.feePaid);
        const interest = take(item.interest - item.interestPaid);
        const principal = take(item.principal - item.principalPaid);
        if (penalty + fee + interest + principal === 0n) continue;

        lines.push({ number: item.number, penalty, fee, interest, principal });
        total.penalty += penalty;
        total.fee += fee;
        total.interest += interest;
        total.principal += principal;
    }

    return { received: amount, lines, ...total, unapplied: remaining };
};
