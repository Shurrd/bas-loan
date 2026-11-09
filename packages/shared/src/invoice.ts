import { daysBetween } from "./dates";
import { divHalfUp } from "./money";
import { parseRate } from "./rate";

const ADVANCE_RATE = parseRate("80");
const DISCOUNT_ANNUAL_RATE = parseRate("36");
const PENALTY_RATE_PER_DAY = parseRate("0.2");
const DAYS_IN_YEAR = 365n;

export interface InvoiceQuote {
  advance: bigint;
  reserve: bigint;
  fee: bigint;
}

export interface InvoiceSettlement extends InvoiceQuote {
  overdueDays: number;
  penalty: bigint;
  payableToClient: bigint;
  shortfall: bigint;
}

export function quoteInvoice(faceValue: bigint, tenorDays: number): InvoiceQuote {
  if (faceValue <= 0n) {
    throw new RangeError("Face value must be positive");
  }
  if (!Number.isInteger(tenorDays) || tenorDays < 0) {
    throw new RangeError("Tenor must be a whole number of days");
  }
  const advance = divHalfUp(faceValue * ADVANCE_RATE.numerator, ADVANCE_RATE.denominator);
  const fee = divHalfUp(
    advance * DISCOUNT_ANNUAL_RATE.numerator * BigInt(tenorDays),
    DISCOUNT_ANNUAL_RATE.denominator * DAYS_IN_YEAR,
  );
  return { advance, reserve: faceValue - advance, fee };
}

// Overdue days start the day after the due date.
export function overdueDays(dueDate: string, settlementDate: string): number {
  return Math.max(0, daysBetween(dueDate, settlementDate));
}

export function settleInvoice(
  faceValue: bigint,
  tenorDays: number,
  dueDate: string,
  settlementDate: string,
): InvoiceSettlement {
  const quote = quoteInvoice(faceValue, tenorDays);
  const overdue = overdueDays(dueDate, settlementDate);
  const penalty = divHalfUp(
    quote.advance * PENALTY_RATE_PER_DAY.numerator * BigInt(overdue),
    PENALTY_RATE_PER_DAY.denominator,
  );
  const charges = quote.fee + penalty;
  return {
    ...quote,
    overdueDays: overdue,
    penalty,
    payableToClient: charges >= quote.reserve ? 0n : quote.reserve - charges,
    shortfall: charges > quote.reserve ? charges - quote.reserve : 0n,
  };
}
