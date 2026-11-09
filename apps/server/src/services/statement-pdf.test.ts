import type { LoanRecord, Statement } from "@lending/shared";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
    buildStatementPdf,
    formatDate,
    loanFacts,
    reconciliation,
    statementFileName,
    statementRows,
} from "./statement-pdf";

const loan: LoanRecord = {
    id: 1n,
    principal: 120_000_000n,
    annualRatePercent: "18",
    termMonths: 6,
    disbursementDate: "2025-01-15",
};

const line = (
    description: string,
    accountName: string,
    side: "debit" | "credit",
    amount: bigint,
    principalBalance: bigint,
    date = "2025-02-15"
) => ({
    entryId: 2n,
    date,
    description,
    accountName,
    debit: side === "debit" ? amount : 0n,
    credit: side === "credit" ? amount : 0n,
    principalBalance,
});

const statement = (): Statement => ({
    lines: [
        line(
            "Loan disbursement",
            "Loans Receivable",
            "debit",
            120_000_000n,
            120_000_000n,
            "2025-01-15"
        ),
        line(
            "Loan disbursement",
            "Cash",
            "credit",
            120_000_000n,
            120_000_000n,
            "2025-01-15"
        ),
        line("Payment received", "Cash", "debit", 30_000_000n, 120_000_000n),
        line("Payment received", "Loans Receivable", "credit", 19_263_026n, 100_736_974n),
    ],
    closingBalance: 100_736_974n,
    tieOut: { outstandingPrincipal: 100_736_974n, difference: 0n, matches: true },
});

const pdfInput = (s = statement()) => ({ loan, statement: s, generatedOn: "2026-11-09" });

const manyLines = (count: number): Statement => {
    const base = statement();
    return {
        ...base,
        lines: Array.from(
            { length: count },
            (_, i) => base.lines[i % base.lines.length]!
        ),
    };
};

describe("statement content", () => {
    it("writes dates as day, month name and year", () => {
        expect(formatDate("2025-02-15")).toBe("15 Feb 2025");
        expect(formatDate("2025-12-01")).toBe("1 Dec 2025");
    });

    it("turns each ledger line into display text, leaving zero debits and credits blank", () => {
        expect(statementRows(statement())).toEqual([
            {
                date: "15 Jan 2025",
                description: "Loan disbursement",
                account: "Loans Receivable",
                debit: "₦1,200,000.00",
                credit: "",
                balance: "₦1,200,000.00",
            },
            {
                date: "15 Jan 2025",
                description: "Loan disbursement",
                account: "Cash",
                debit: "",
                credit: "₦1,200,000.00",
                balance: "₦1,200,000.00",
            },
            {
                date: "15 Feb 2025",
                description: "Payment received",
                account: "Cash",
                debit: "₦300,000.00",
                credit: "",
                balance: "₦1,200,000.00",
            },
            {
                date: "15 Feb 2025",
                description: "Payment received",
                account: "Loans Receivable",
                debit: "",
                credit: "₦192,630.26",
                balance: "₦1,007,369.74",
            },
        ]);
    });

    it("lists the loan's terms", () => {
        expect(loanFacts(loan)).toEqual([
            { label: "Principal", value: "₦1,200,000.00" },
            { label: "Annual rate", value: "18%" },
            { label: "Term", value: "6 months" },
            { label: "Disbursed", value: "15 Jan 2025" },
        ]);
    });

    it("says reconciled when the statement and the schedule agree", () => {
        expect(
            reconciliation({ outstandingPrincipal: 5n, difference: 0n, matches: true })
        ).toEqual({
            matched: true,
            label: "Reconciled",
            detail: ["Equals the repayment schedule"],
        });
    });

    it("gives the whole difference in kobo and naira when they disagree", () => {
        expect(
            reconciliation({
                outstandingPrincipal: 100_736_974n,
                difference: 19_263_026n,
                matches: false,
            })
        ).toEqual({
            matched: false,
            label: "Does not reconcile",
            detail: ["Difference 19,263,026 kobo", "(₦192,630.26)"],
        });
        expect(
            reconciliation({
                outstandingPrincipal: 5n,
                difference: -1_000n,
                matches: false,
            }).detail
        ).toEqual(["Difference -1,000 kobo", "(-₦10.00)"]);
    });

    it("names the file after the loan", () => {
        expect(statementFileName(12n)).toBe("loan-12-statement.pdf");
    });
});

describe("buildStatementPdf", () => {
    it("produces a one-page PDF for a short statement, titled for the loan", async () => {
        const bytes = await buildStatementPdf(pdfInput());
        expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

        const pdf = await PDFDocument.load(bytes);
        expect(pdf.getPageCount()).toBe(1);
        expect(pdf.getTitle()).toBe("Loan 1 statement");
        expect(pdf.getAuthor()).toBe("Lending");
        const { width, height } = pdf.getPage(0).getSize();
        expect(Math.round(width)).toBe(595);
        expect(Math.round(height)).toBe(842);
    });

    it("runs onto more pages for a long statement", async () => {
        const short = await PDFDocument.load(
            await buildStatementPdf(pdfInput(manyLines(10)))
        );
        const long = await PDFDocument.load(
            await buildStatementPdf(pdfInput(manyLines(120)))
        );

        expect(short.getPageCount()).toBe(1);
        expect(long.getPageCount()).toBeGreaterThanOrEqual(4);
    });

    it("builds a statement that does not reconcile, and one with a negative difference", async () => {
        const bad: Statement = {
            ...statement(),
            tieOut: {
                outstandingPrincipal: 100_736_974n,
                difference: 19_263_026n,
                matches: false,
            },
        };
        const negative: Statement = {
            ...statement(),
            tieOut: {
                outstandingPrincipal: 100_737_974n,
                difference: -1_000n,
                matches: false,
            },
        };
        for (const input of [bad, negative]) {
            const pdf = await PDFDocument.load(await buildStatementPdf(pdfInput(input)));
            expect(pdf.getPageCount()).toBe(1);
        }
    });

    it("handles very large amounts and a very long description without breaking", async () => {
        const huge: Statement = {
            lines: [
                {
                    ...line(
                        "A description that is far too long to fit its column on one line",
                        "Loans Receivable",
                        "debit",
                        99_999_999_999_999n,
                        99_999_999_999_999n
                    ),
                },
            ],
            closingBalance: 99_999_999_999_999n,
            tieOut: {
                outstandingPrincipal: 99_999_999_999_999n,
                difference: 0n,
                matches: true,
            },
        };
        const pdf = await PDFDocument.load(await buildStatementPdf(pdfInput(huge)));
        expect(pdf.getPageCount()).toBe(1);
    });
});
