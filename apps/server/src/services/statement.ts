import type { StatementLine } from "@lending/shared";
import type { Db } from "@/db";
import { ACCOUNTS } from "@/lib/constant";
import type { AccountCode } from "@/types/ledger";

type Row = {
    entry_id: bigint;
    entry_date: string;
    kind: string;
    reverses_entry_id: bigint | null;
    account_code: AccountCode;
    side: "debit" | "credit";
    amount: bigint;
};

const KIND_LABELS: Record<string, string> = {
    disbursement: "Loan disbursement",
    payment: "Payment received",
    reversal: "Reversal",
};

// Built from this loan's journal lines and nothing else. The principal balance is Loans
// Receivable debits minus credits, so Unapplied Credit, interest, fees and penalties leave it alone.
export const getStatement = (db: Db, loanId: bigint) => {
    const rows = db
        .prepare(
            `SELECT e.id AS entry_id, e.entry_date, e.kind, e.reverses_entry_id,
                    l.account_code, l.side, l.amount
             FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
             WHERE l.loan_id = ?
             ORDER BY e.entry_date, e.id, l.id`
        )
        .all(loanId) as Row[];

    let balance = 0n;
    const lines = rows.map((row): StatementLine => {
        if (row.account_code === "LOANS_RECEIVABLE") {
            balance += row.side === "debit" ? row.amount : -row.amount;
        }
        return {
            entryId: row.entry_id,
            date: row.entry_date,
            description:
                row.kind === "reversal"
                    ? `Reversal of entry ${row.reverses_entry_id}`
                    : (KIND_LABELS[row.kind] ?? row.kind),
            accountName: ACCOUNTS[row.account_code].name,
            debit: row.side === "debit" ? row.amount : 0n,
            credit: row.side === "credit" ? row.amount : 0n,
            principalBalance: balance,
        };
    });
    return { lines, closingBalance: balance };
};
