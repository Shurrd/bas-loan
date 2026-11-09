import type {
    InstalmentState,
    JournalEntryRecord,
    LoanDetail,
    LoanRecord,
    LoanSummary,
} from "@lending/shared";
import type { Db } from "@/db";
import { ACCOUNTS, LIST_LIMIT } from "@/lib/constant";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { postEntry } from "@/services/ledger";
import { disbursementLines } from "@/services/posting";
import { getQuoteTerms } from "@/services/quote";
import type { AccountCode } from "@/types/ledger";

type LoanRow = {
    id: bigint;
    principal: bigint;
    annual_rate: string;
    term_months: bigint;
    disbursement_date: string;
};

type SummaryRow = LoanRow & { outstanding: bigint };

type InstalmentRow = {
    number: bigint;
    due_date: string;
    interest: bigint;
    principal: bigint;
    penalty_due: bigint;
    fee_due: bigint;
    interest_paid: bigint;
    principal_paid: bigint;
    penalty_paid: bigint;
    fee_paid: bigint;
};

type EntryRow = {
    id: bigint;
    kind: string;
    entry_date: string;
    reverses_entry_id: bigint | null;
};

type LineRow = { account_code: AccountCode; side: "debit" | "credit"; amount: bigint };

// Copies the saved quote's terms, so the client can never change them at approval
export const createLoan = (db: Db, quoteId: bigint) =>
    BigInt(
        db
            .prepare(
                `INSERT INTO loans (quote_id, principal, annual_rate, term_months, disbursement_date)
                 SELECT id, principal, annual_rate, term_months, disbursement_date FROM quotes WHERE id = ?`
            )
            .run(quoteId).lastInsertRowid
    );

// Loan, instalments and the disbursement entry are written together or not at all
export const originateLoan = (db: Db, quoteId: bigint) =>
    db.transaction((): LoanDetail => {
        const terms = getQuoteTerms(db, quoteId);

        const existing = db
            .prepare("SELECT id FROM loans WHERE quote_id = ?")
            .get(quoteId) as { id: bigint } | undefined;
        if (existing) {
            throw new ConflictError("This quote has already been approved", {
                loanId: existing.id.toString(),
            });
        }

        const loanId = createLoan(db, quoteId);
        db.prepare(
            `INSERT INTO loan_instalments (loan_id, number, due_date, interest, principal)
             SELECT ?, number, due_date, interest, principal FROM quote_instalments WHERE quote_id = ?`
        ).run(loanId, quoteId);

        postEntry(db, {
            kind: "disbursement",
            entryDate: terms.disbursementDate,
            loanId,
            lines: disbursementLines(terms.principal),
        });
        return getLoanDetail(db, loanId);
    })();

export const getLoanRecord = (db: Db, loanId: bigint): LoanRecord => {
    const row = db.prepare("SELECT * FROM loans WHERE id = ?").get(loanId) as
        LoanRow | undefined;
    if (!row) throw new NotFoundError("Loan not found");

    return {
        id: row.id,
        principal: row.principal,
        annualRatePercent: row.annual_rate,
        termMonths: Number(row.term_months),
        disbursementDate: row.disbursement_date,
    };
};

export const getInstalmentStates = (db: Db, loan: LoanRecord): InstalmentState[] => {
    let balance = loan.principal;
    return (
        db
            .prepare("SELECT * FROM loan_instalments WHERE loan_id = ? ORDER BY number")
            .all(loan.id) as InstalmentRow[]
    ).map((row) => {
        balance -= row.principal;
        return {
            number: Number(row.number),
            dueDate: row.due_date,
            payment: row.interest + row.principal,
            interest: row.interest,
            principal: row.principal,
            closingBalance: balance,
            penaltyDue: row.penalty_due,
            feeDue: row.fee_due,
            interestPaid: row.interest_paid,
            principalPaid: row.principal_paid,
            penaltyPaid: row.penalty_paid,
            feePaid: row.fee_paid,
        };
    });
};

export const getJournalEntries = (
    db: Db,
    where: "loan_id" | "invoice_id" | "id",
    value: bigint
) => {
    const selectLines = db.prepare(
        "SELECT account_code, side, amount FROM journal_lines WHERE entry_id = ? ORDER BY id"
    );
    return (
        db
            .prepare(
                `SELECT id, kind, entry_date, reverses_entry_id FROM journal_entries WHERE ${where} = ? ORDER BY id`
            )
            .all(value) as EntryRow[]
    ).map((entry): JournalEntryRecord => ({
        id: entry.id,
        kind: entry.kind,
        entryDate: entry.entry_date,
        reversesEntryId: entry.reverses_entry_id,
        lines: (selectLines.all(entry.id) as LineRow[]).map((line) => ({
            account: line.account_code,
            accountName: ACCOUNTS[line.account_code].name,
            side: line.side,
            amount: line.amount,
        })),
    }));
};

export const getLoanDetail = (db: Db, loanId: bigint): LoanDetail => {
    const loan = getLoanRecord(db, loanId);
    return {
        loan,
        schedule: getInstalmentStates(db, loan),
        entries: getJournalEntries(db, "loan_id", loanId),
    };
};

// Outstanding principal is summed from instalment state, the same source the tie-out uses
export const listLoans = (db: Db): LoanSummary[] =>
    (
        db
            .prepare(
                `SELECT l.id, l.principal, l.annual_rate, l.term_months, l.disbursement_date,
                        COALESCE(SUM(i.principal - i.principal_paid), 0) AS outstanding
                 FROM loans l LEFT JOIN loan_instalments i ON i.loan_id = l.id
                 GROUP BY l.id ORDER BY l.id DESC LIMIT ?`
            )
            .all(LIST_LIMIT) as SummaryRow[]
    ).map((row) => ({
        id: row.id,
        principal: row.principal,
        annualRatePercent: row.annual_rate,
        termMonths: Number(row.term_months),
        disbursementDate: row.disbursement_date,
        outstandingPrincipal: row.outstanding,
    }));
