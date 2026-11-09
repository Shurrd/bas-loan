import { mkdtempSync, rmSync } from "node:fs";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { type Db, openDatabase } from "@/db";
import { createLoan } from "@/services/loan";
import { saveQuote } from "@/services/quote";
import { insertInvoice, insertLoan } from "@/test-helpers";
import { postEntry } from "@/services/ledger";
import { disbursementLines, invoiceAdvanceLines } from "@/services/posting";

const insertEntry = (
    db: Db,
    kind: string,
    loanId: bigint | null,
    invoiceId: bigint | null
) =>
    db
        .prepare(
            "INSERT INTO journal_entries (kind, entry_date, loan_id, invoice_id) VALUES (?, '2025-01-15', ?, ?)"
        )
        .run(kind, loanId, invoiceId);

describe("journal tables", () => {
    let db: Db;
    let loanId: bigint;
    let entryId: bigint;

    beforeEach(() => {
        db = openDatabase();
        loanId = insertLoan(db, {
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

    it("rejects UPDATE and DELETE on journal_entries", () => {
        expect(() =>
            db.prepare("UPDATE journal_entries SET entry_date = '2030-01-01'").run()
        ).toThrow(/append-only/);
        expect(() => db.prepare("DELETE FROM journal_entries").run()).toThrow(
            /append-only/
        );
    });

    it("rejects UPDATE and DELETE on journal_lines", () => {
        expect(() => db.prepare("UPDATE journal_lines SET amount = 1").run()).toThrow(
            /append-only/
        );
        expect(() => db.prepare("DELETE FROM journal_lines").run()).toThrow(
            /append-only/
        );
    });

    it("leaves the journal intact after the rejected changes", () => {
        expect(() => db.prepare("DELETE FROM journal_lines").run()).toThrow();
        const count = db.prepare("SELECT COUNT(*) AS n FROM journal_lines").get() as {
            n: bigint;
        };
        expect(count.n).toBe(2n);
    });

    it("rejects a second disbursement of the same loan, whatever the amount", () => {
        expect(() => insertEntry(db, "disbursement", loanId, null)).toThrow(/UNIQUE/);
        expect(() =>
            postEntry(db, {
                kind: "disbursement",
                entryDate: "2025-01-16",
                loanId,
                lines: disbursementLines(1n),
            })
        ).toThrow(/UNIQUE/);
        const count = db.prepare("SELECT COUNT(*) AS n FROM journal_entries").get() as {
            n: bigint;
        };
        expect(count.n).toBe(1n);
    });

    it("rejects a second advance on the same invoice", () => {
        const invoiceId = insertInvoice(db, {
            faceValue: 100_000_000n,
            tenorDays: 60,
            fundingDate: "2024-12-31",
        });
        const advance = {
            kind: "invoice_advance",
            entryDate: "2024-12-31",
            invoiceId,
            lines: invoiceAdvanceLines(80_000_000n),
        } as const;
        postEntry(db, advance);
        expect(() => postEntry(db, advance)).toThrow(/UNIQUE/);
    });

    it("requires exactly one of loan or invoice on an entry, matching its kind", () => {
        expect(() => insertEntry(db, "payment", null, null)).toThrow(/CHECK/);
        expect(() => insertEntry(db, "payment", loanId, 1n)).toThrow(/CHECK/);
        expect(() => insertEntry(db, "disbursement", null, 1n)).toThrow();
    });

    it("rejects a line that points at a different loan than its entry", () => {
        const other = insertLoan(db, {
            principal: 1_000n,
            annualRatePercent: "18",
            termMonths: 1,
            disbursementDate: "2025-01-15",
        });
        expect(() =>
            db
                .prepare(
                    "INSERT INTO journal_lines (entry_id, account_code, side, amount, loan_id) VALUES (?, 'CASH', 'debit', 5, ?)"
                )
                .run(entryId, other)
        ).toThrow(/does not match its entry/);
    });

    it("links every posted line to the loan", () => {
        const rows = db
            .prepare("SELECT loan_id FROM journal_lines WHERE entry_id = ?")
            .all(entryId) as { loan_id: bigint }[];
        expect(rows.map((row) => row.loan_id)).toEqual([loanId, loanId]);
    });
});

describe("openDatabase", () => {
    it("can reopen an existing file without losing or duplicating anything", () => {
        const dir = mkdtempSync(join(tmpdir(), "lending-"));
        try {
            const path = join(dir, "test.db");
            const first = openDatabase(path);
            insertLoan(first, {
                principal: 1_000n,
                annualRatePercent: "18",
                termMonths: 1,
                disbursementDate: "2025-01-15",
            });
            first.close();

            const second = openDatabase(path);
            const loans = second.prepare("SELECT COUNT(*) AS n FROM loans").get() as {
                n: bigint;
            };
            const accounts = second
                .prepare("SELECT COUNT(*) AS n FROM accounts")
                .get() as { n: bigint };
            expect(loans.n).toBe(1n);
            expect(accounts.n).toBe(9n);
            second.close();
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("quotes", () => {
    const terms = {
        principal: 120_000_000n,
        annualRatePercent: "18",
        termMonths: 6,
        disbursementDate: "2025-01-15",
    };

    it("allows one loan per quote at the database level", () => {
        const db = openDatabase();
        const { quoteId } = saveQuote(db, terms);
        createLoan(db, quoteId);
        expect(() => createLoan(db, quoteId)).toThrow(/UNIQUE/);
    });

    it("lets two quotes with identical terms each have a loan", () => {
        const db = openDatabase();
        createLoan(db, saveQuote(db, terms).quoteId);
        expect(() => createLoan(db, saveQuote(db, terms).quoteId)).not.toThrow();
    });

    it("cannot be edited or deleted once saved", () => {
        const db = openDatabase();
        saveQuote(db, terms);
        expect(() => db.prepare("UPDATE quotes SET principal = 1").run()).toThrow(
            /append-only/
        );
        expect(() => db.prepare("DELETE FROM quotes").run()).toThrow(/append-only/);
        expect(() =>
            db.prepare("UPDATE quote_instalments SET interest = 1").run()
        ).toThrow(/append-only/);
        expect(() => db.prepare("DELETE FROM quote_instalments").run()).toThrow(
            /append-only/
        );
    });

    it("refuses a database file made before the schema changed, without touching it", () => {
        const dir = mkdtempSync(join(tmpdir(), "lending-"));
        try {
            const path = join(dir, "old.db");
            const old = new Database(path);
            old.exec("CREATE TABLE loans (id INTEGER PRIMARY KEY, principal INTEGER)");
            old.close();

            expect(() => openDatabase(path)).toThrow(/older version/);

            const check = new Database(path, { readonly: true });
            const tables = check.prepare("SELECT name FROM sqlite_master").all();
            expect(tables).toEqual([{ name: "loans" }]);
            check.close();
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
