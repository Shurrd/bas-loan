import { beforeEach, describe, expect, it } from "vitest";
import { type Db, openDatabase } from "@/db";
import { LedgerError } from "@/lib/errors";
import { getEntryLines, postEntry, reverseEntry } from "@/services/ledger";
import { createInvoice } from "@/services/invoice";
import { createLoan } from "@/services/loan";
import { disbursementLines, invoiceAdvanceLines, paymentLines } from "@/services/posting";
import type { LedgerLine } from "@/types/ledger";

const count = (db: Db, table: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: bigint }).n;

describe("postEntry", () => {
    let db: Db;
    let loanId: bigint;

    const post = (lines: LedgerLine[]) =>
        postEntry(db, { kind: "disbursement", entryDate: "2025-01-15", loanId, lines });

    beforeEach(() => {
        db = openDatabase();
        loanId = createLoan(db, {
            principal: 100_000n,
            annualRatePercent: "18",
            termMonths: 3,
            disbursementDate: "2025-01-15",
        });
    });

    it("rejects an unbalanced entry and leaves nothing behind", () => {
        expect(() =>
            post([
                { account: "LOANS_RECEIVABLE", side: "debit", amount: 100n },
                { account: "CASH", side: "credit", amount: 90n },
            ])
        ).toThrow(/does not balance/);
        expect(count(db, "journal_entries")).toBe(0n);
        expect(count(db, "journal_lines")).toBe(0n);
    });

    it("rejects an entry with no lines or one line", () => {
        expect(() => post([])).toThrow(LedgerError);
        expect(() => post([{ account: "CASH", side: "debit", amount: 100n }])).toThrow(
            /at least two/
        );
        expect(count(db, "journal_entries")).toBe(0n);
    });

    it("rejects an entry that is left with one line once zero lines are dropped", () => {
        expect(() =>
            post([
                { account: "LOANS_RECEIVABLE", side: "debit", amount: 100n },
                { account: "CASH", side: "credit", amount: 0n },
            ])
        ).toThrow(/at least two/);
        expect(count(db, "journal_entries")).toBe(0n);
    });

    it("rejects a negative amount", () => {
        expect(() =>
            post([
                { account: "LOANS_RECEIVABLE", side: "debit", amount: -100n },
                { account: "CASH", side: "credit", amount: -100n },
            ])
        ).toThrow(/CHECK/);
        expect(count(db, "journal_entries")).toBe(0n);
    });

    it("does not post zero-amount lines", () => {
        const entryId = postEntry(db, {
            kind: "payment",
            entryDate: "2025-02-15",
            loanId,
            lines: paymentLines({
                principal: 30_000n,
                interest: 1_500n,
                penalty: 0n,
                fee: 0n,
                unapplied: 0n,
            }),
        });
        expect(getEntryLines(db, entryId)).toEqual([
            { account: "CASH", side: "debit", amount: 31_500n },
            { account: "LOANS_RECEIVABLE", side: "credit", amount: 30_000n },
            { account: "INTEREST_INCOME", side: "credit", amount: 1_500n },
        ]);
    });
});

describe("reverseEntry", () => {
    let db: Db;
    let loanId: bigint;
    let entryId: bigint;

    const snapshot = () => ({
        entry: db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(entryId),
        lines: db
            .prepare("SELECT * FROM journal_lines WHERE entry_id = ? ORDER BY id")
            .all(entryId),
    });

    beforeEach(() => {
        db = openDatabase();
        loanId = createLoan(db, {
            principal: 120_000_000n,
            annualRatePercent: "18",
            termMonths: 6,
            disbursementDate: "2025-01-15",
        });
        entryId = postEntry(db, {
            kind: "disbursement",
            entryDate: "2025-01-15",
            loanId,
            lines: disbursementLines(120_000_000n),
        });
    });

    it("posts the original lines with the sides swapped", () => {
        const reversalId = reverseEntry(db, entryId, "2025-01-16");
        expect(getEntryLines(db, reversalId)).toEqual([
            { account: "LOANS_RECEIVABLE", side: "credit", amount: 120_000_000n },
            { account: "CASH", side: "debit", amount: 120_000_000n },
        ]);
    });

    it("balances, and links to the same loan and the entry it reverses", () => {
        const reversalId = reverseEntry(db, entryId, "2025-01-16");
        const header = db
            .prepare("SELECT * FROM journal_entries WHERE id = ?")
            .get(reversalId) as {
            kind: string;
            loan_id: bigint;
            reverses_entry_id: bigint;
        };
        expect(header).toMatchObject({
            kind: "reversal",
            loan_id: loanId,
            reverses_entry_id: entryId,
        });

        const net = db
            .prepare(
                `SELECT SUM(CASE WHEN side = 'debit' THEN amount ELSE -amount END) AS net,
                        SUM(CASE WHEN account_code = 'LOANS_RECEIVABLE' AND side = 'debit' THEN amount
                                 WHEN account_code = 'LOANS_RECEIVABLE' THEN -amount ELSE 0 END) AS loans
                 FROM journal_lines WHERE loan_id = ?`
            )
            .get(loanId) as { net: bigint; loans: bigint };
        expect(net).toEqual({ net: 0n, loans: 0n });
    });

    it("leaves the original entry and lines untouched", () => {
        const before = snapshot();
        reverseEntry(db, entryId, "2025-01-16");
        expect(snapshot()).toEqual(before);
    });

    it("cannot reverse the same entry twice", () => {
        reverseEntry(db, entryId, "2025-01-16");
        expect(() => reverseEntry(db, entryId, "2025-01-17")).toThrow(/UNIQUE/);
        expect(count(db, "journal_entries")).toBe(2n);
    });

    it("rejects an entry that does not exist", () => {
        expect(() => reverseEntry(db, 999n, "2025-01-16")).toThrow(LedgerError);
    });

    it("keeps the invoice link when reversing an invoice entry", () => {
        const invoiceId = createInvoice(db, {
            faceValue: 100_000_000n,
            tenorDays: 60,
            advanceDate: "2024-12-31",
            dueDate: "2025-03-01",
        });
        const advanceId = postEntry(db, {
            kind: "invoice_advance",
            entryDate: "2024-12-31",
            invoiceId,
            lines: invoiceAdvanceLines(80_000_000n),
        });
        const reversalId = reverseEntry(db, advanceId, "2025-01-02");
        const rows = db
            .prepare("SELECT invoice_id FROM journal_lines WHERE entry_id = ?")
            .all(reversalId) as { invoice_id: bigint }[];
        expect(rows.map((row) => row.invoice_id)).toEqual([invoiceId, invoiceId]);
    });
});
