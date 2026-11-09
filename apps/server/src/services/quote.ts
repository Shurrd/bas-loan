import {
    buildSchedule,
    type Instalment,
    type LoanQuote,
    type LoanTerms,
} from "@lending/shared";
import type { Db } from "@/db";
import { NotFoundError } from "@/lib/errors";

type QuoteRow = {
    principal: bigint;
    annual_rate: string;
    term_months: bigint;
    disbursement_date: string;
};

const totalInterest = (schedule: Instalment[]) =>
    schedule.reduce((sum, row) => sum + row.interest, 0n);

// Saves the terms and schedule only. Nothing is posted until the quote is approved.
export const saveQuote = (db: Db, terms: LoanTerms): LoanQuote =>
    db.transaction(() => {
        const schedule = buildSchedule(terms);
        const quoteId = BigInt(
            db
                .prepare(
                    `INSERT INTO quotes (principal, annual_rate, term_months, disbursement_date)
                     VALUES (?, ?, ?, ?)`
                )
                .run(
                    terms.principal,
                    terms.annualRatePercent,
                    terms.termMonths,
                    terms.disbursementDate
                ).lastInsertRowid
        );

        const insertRow = db.prepare(
            `INSERT INTO quote_instalments (quote_id, number, due_date, interest, principal)
             VALUES (?, ?, ?, ?, ?)`
        );
        for (const row of schedule) {
            insertRow.run(quoteId, row.number, row.dueDate, row.interest, row.principal);
        }
        return { quoteId, schedule, totalInterest: totalInterest(schedule) };
    })();

export const getQuoteTerms = (db: Db, quoteId: bigint): LoanTerms => {
    const row = db.prepare("SELECT * FROM quotes WHERE id = ?").get(quoteId) as
        QuoteRow | undefined;
    if (!row) throw new NotFoundError("Quote not found");

    return {
        principal: row.principal,
        annualRatePercent: row.annual_rate,
        termMonths: Number(row.term_months),
        disbursementDate: row.disbursement_date,
    };
};
