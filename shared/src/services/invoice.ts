import {
    ADVANCE_RATE,
    DAYS_IN_YEAR,
    DISCOUNT_ANNUAL_RATE,
    PENALTY_RATE_PER_DAY,
} from "../lib/constant";
import { daysBetween } from "../lib/date";
import { divHalfUp } from "../lib/money";
import type { InvoiceQuote, InvoiceSettlement } from "../types/invoice";

export const quoteInvoice = (faceValue: bigint, tenorDays: number): InvoiceQuote => {
    if (faceValue <= 0n) throw new RangeError("Face value must be positive");
    if (!Number.isInteger(tenorDays) || tenorDays < 0) {
        throw new RangeError("Tenor must be a whole number of days");
    }

    const advance = divHalfUp(
        faceValue * ADVANCE_RATE.numerator,
        ADVANCE_RATE.denominator
    );
    const fee = divHalfUp(
        advance * DISCOUNT_ANNUAL_RATE.numerator * BigInt(tenorDays),
        DISCOUNT_ANNUAL_RATE.denominator * DAYS_IN_YEAR
    );
    return { advance, reserve: faceValue - advance, fee };
};

// Overdue days start the day after the due date
export const overdueDays = (dueDate: string, settlementDate: string) =>
    Math.max(0, daysBetween(dueDate, settlementDate));

export const settleInvoice = (
    faceValue: bigint,
    tenorDays: number,
    dueDate: string,
    settlementDate: string
): InvoiceSettlement => {
    const quote = quoteInvoice(faceValue, tenorDays);
    const overdue = overdueDays(dueDate, settlementDate);
    const penalty = divHalfUp(
        quote.advance * PENALTY_RATE_PER_DAY.numerator * BigInt(overdue),
        PENALTY_RATE_PER_DAY.denominator
    );
    const charges = quote.fee + penalty;

    return {
        ...quote,
        overdueDays: overdue,
        penalty,
        payableToClient: charges >= quote.reserve ? 0n : quote.reserve - charges,
        shortfall: charges > quote.reserve ? charges - quote.reserve : 0n,
    };
};
