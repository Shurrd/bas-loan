import type { LoanTerms } from "@lending/shared";
import type { Db } from "@/db";

export const createLoan = (db: Db, terms: LoanTerms) =>
    BigInt(
        db
            .prepare(
                `INSERT INTO loans (principal, annual_rate, term_months, disbursement_date)
                 VALUES (?, ?, ?, ?)`
            )
            .run(
                terms.principal,
                terms.annualRatePercent,
                terms.termMonths,
                terms.disbursementDate
            ).lastInsertRowid
    );
