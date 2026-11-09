import type { Db } from "@/db";
import { LedgerError } from "@/lib/errors";
import type { LedgerLine, NewEntry } from "@/types/ledger";

type LineRow = {
    account_code: LedgerLine["account"];
    side: LedgerLine["side"];
    amount: bigint;
};

type EntryRow = { kind: string; loan_id: bigint | null; invoice_id: bigint | null };

// Zero lines are dropped, then the entry must still have two lines and balance.
// Checked inside the transaction so a bad entry rolls back whole.
export const postEntry = (db: Db, entry: NewEntry) => {
    const lines = entry.lines.filter((line) => line.amount !== 0n);
    const loanId = entry.loanId ?? null;
    const invoiceId = entry.invoiceId ?? null;

    return db.transaction(() => {
        const header = db
            .prepare(
                `INSERT INTO journal_entries (kind, entry_date, loan_id, invoice_id, reverses_entry_id)
                 VALUES (?, ?, ?, ?, ?)`
            )
            .run(
                entry.kind,
                entry.entryDate,
                loanId,
                invoiceId,
                entry.reversesEntryId ?? null
            );
        const entryId = BigInt(header.lastInsertRowid);

        const insertLine = db.prepare(
            `INSERT INTO journal_lines (entry_id, account_code, side, amount, loan_id, invoice_id)
             VALUES (?, ?, ?, ?, ?, ?)`
        );
        for (const line of lines) {
            insertLine.run(
                entryId,
                line.account,
                line.side,
                line.amount,
                loanId,
                invoiceId
            );
        }

        const totals = db
            .prepare(
                `SELECT COUNT(*) AS count,
                        COALESCE(SUM(CASE WHEN side = 'debit' THEN amount END), 0) AS debit,
                        COALESCE(SUM(CASE WHEN side = 'credit' THEN amount END), 0) AS credit
                 FROM journal_lines WHERE entry_id = ?`
            )
            .get(entryId) as { count: bigint; debit: bigint; credit: bigint };

        if (totals.count < 2n) {
            throw new LedgerError("A journal entry needs at least two non-zero lines");
        }
        if (totals.debit !== totals.credit) {
            throw new LedgerError(
                `Entry does not balance: debits ${totals.debit}, credits ${totals.credit}`
            );
        }
        return entryId;
    })();
};

export const getEntryLines = (db: Db, entryId: bigint): LedgerLine[] =>
    (
        db
            .prepare(
                "SELECT account_code, side, amount FROM journal_lines WHERE entry_id = ? ORDER BY id"
            )
            .all(entryId) as LineRow[]
    ).map((row) => ({ account: row.account_code, side: row.side, amount: row.amount }));

// Corrections never edit an entry: the reversal posts the same lines with the sides swapped
export const reverseEntry = (db: Db, entryId: bigint, entryDate: string) => {
    const original = db
        .prepare("SELECT kind, loan_id, invoice_id FROM journal_entries WHERE id = ?")
        .get(entryId) as EntryRow | undefined;
    if (!original) throw new LedgerError(`Journal entry ${entryId} not found`);

    return postEntry(db, {
        kind: "reversal",
        entryDate,
        loanId: original.loan_id ?? undefined,
        invoiceId: original.invoice_id ?? undefined,
        reversesEntryId: entryId,
        lines: getEntryLines(db, entryId).map((line) => ({
            ...line,
            side: line.side === "debit" ? "credit" : "debit",
        })),
    });
};
