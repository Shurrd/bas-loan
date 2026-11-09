import { addMonths } from "./dates";
import { divHalfUp } from "./money";
import { monthlyRate, parseRate, type Fraction } from "./rate";

export interface LoanTerms {
  principal: bigint;
  annualRatePercent: string;
  termMonths: number;
  disbursementDate: string;
}

export interface Instalment {
  number: number;
  dueDate: string;
  payment: bigint;
  interest: bigint;
  principal: bigint;
  closingBalance: bigint;
}

// With i = a/b: P*i / (1 - (1+i)^-n) = P*a*(a+b)^n / (b*((a+b)^n - b^n)).
export function instalmentAmount(principal: bigint, rate: Fraction, termMonths: number): bigint {
  const { numerator: a, denominator: b } = rate;
  const n = BigInt(termMonths);
  if (a === 0n) {
    return divHalfUp(principal, n);
  }
  const growth = (a + b) ** n;
  return divHalfUp(principal * a * growth, b * (growth - b ** n));
}

export function buildSchedule(terms: LoanTerms): Instalment[] {
  const { principal, termMonths, disbursementDate } = terms;
  if (principal <= 0n) {
    throw new RangeError("Principal must be positive");
  }
  if (!Number.isInteger(termMonths) || termMonths < 1) {
    throw new RangeError("Term must be a whole number of months");
  }

  const rate = monthlyRate(parseRate(terms.annualRatePercent));
  const regular = instalmentAmount(principal, rate, termMonths);
  const schedule: Instalment[] = [];
  let balance = principal;

  for (let number = 1; number <= termMonths; number++) {
    const interest = divHalfUp(balance * rate.numerator, rate.denominator);
    const isLast = number === termMonths;
    const principalPaid = isLast ? balance : regular - interest;
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
}
