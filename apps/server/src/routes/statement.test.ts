import { buildSchedule } from "@lending/shared";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Db, openDatabase } from "@/db";
import { reverseEntry } from "@/services/ledger";
import { startTestServer } from "@/test-helpers";

const terms = {
    principal: "120000000",
    annualRatePercent: "18",
    termMonths: 6,
    disbursementDate: "2025-01-15",
};

type Line = {
    description: string;
    accountName: string;
    debit: string;
    credit: string;
    principalBalance: string;
};

describe("statement and tie-out", () => {
    let db: Db;
    let api: Awaited<ReturnType<typeof startTestServer>>;
    let keyCount = 0;

    const key = () => ({
        "Idempotency-Key": `statement-${String(++keyCount).padStart(4, "0")}`,
    });

    const openLoan = async () => {
        const { quoteId } = await (await api.post("/api/loans/quote", terms)).json();
        return (await (await api.post("/api/loans", { quoteId }, key())).json()).loan
            .id as string;
    };

    // Previews and confirms the way the officer does, returning the posted entry id
    const pay = async (loanId: string, amount: string, paymentDate: string) => {
        const { stateVersion } = await (
            await api.post(`/api/loans/${loanId}/payments/preview`, {
                amount,
                paymentDate,
            })
        ).json();
        const res = await api.post(
            `/api/loans/${loanId}/payments`,
            { amount, paymentDate, stateVersion },
            key()
        );
        return (await res.json()).entry.id as string;
    };

    const statement = async (loanId = "1") =>
        (await api.get(`/api/loans/${loanId}/statement`)).json();

    const rows = (lines: Line[]) =>
        lines.map((l) => [l.accountName, l.debit, l.credit, l.principalBalance]);

    beforeEach(async () => {
        keyCount = 0;
        db = openDatabase();
        api = await startTestServer(db);
    });

    afterEach(async () => {
        await api.close();
    });

    it("shows a new loan: the principal balance starts at the disbursement and ties out", async () => {
        await openLoan();
        const body = await statement();

        expect(rows(body.lines)).toEqual([
            ["Loans Receivable", "120000000", "0", "120000000"],
            ["Cash", "0", "120000000", "120000000"],
        ]);
        expect(body.lines[0]).toMatchObject({
            date: "2025-01-15",
            description: "Loan disbursement",
        });
        expect(body.closingBalance).toBe("120000000");
        expect(body.tieOut).toEqual({
            outstandingPrincipal: "120000000",
            difference: "0",
            matches: true,
        });
    });

    it("leaves the principal balance alone for a payment that stops inside interest", async () => {
        await openLoan();
        await pay("1", "500000", "2025-02-15");
        const body = await statement();

        expect(rows(body.lines).slice(2)).toEqual([
            ["Cash", "500000", "0", "120000000"],
            ["Interest Income", "0", "500000", "120000000"],
        ]);
        expect(body.lines[2]).toMatchObject({
            date: "2025-02-15",
            description: "Payment received",
        });
        expect(body.closingBalance).toBe("120000000");
        expect(body.tieOut.matches).toBe(true);
    });

    it("reduces the principal balance only by the principal part of a payment", async () => {
        await openLoan();
        await pay("1", "2000000", "2025-02-15");
        const body = await statement();

        expect(rows(body.lines).slice(2)).toEqual([
            ["Cash", "2000000", "0", "120000000"],
            ["Loans Receivable", "0", "200000", "119800000"],
            ["Interest Income", "0", "1800000", "119800000"],
        ]);
        expect(body.closingBalance).toBe("119800000");
        expect(body.tieOut).toEqual({
            outstandingPrincipal: "119800000",
            difference: "0",
            matches: true,
        });
    });

    it("does not let Unapplied Credit change the principal balance", async () => {
        await openLoan();
        await pay("1", "30000000", "2025-02-15");
        const body = await statement();

        expect(rows(body.lines).slice(2)).toEqual([
            ["Cash", "30000000", "0", "120000000"],
            ["Loans Receivable", "0", "19263026", "100736974"],
            ["Interest Income", "0", "1800000", "100736974"],
            ["Unapplied Credit", "0", "8936974", "100736974"],
        ]);
        expect(body.closingBalance).toBe("100736974");
        expect(body.tieOut.matches).toBe(true);
    });

    it("follows Worked Example 1 to zero when every instalment is paid on its due date", async () => {
        await openLoan();
        const schedule = buildSchedule({
            principal: 120_000_000n,
            annualRatePercent: "18",
            termMonths: 6,
            disbursementDate: "2025-01-15",
        });

        for (const row of schedule) {
            await pay("1", row.payment.toString(), row.dueDate);
            const body = await statement();
            expect(body.closingBalance).toBe(row.closingBalance.toString());
            expect(body.tieOut).toEqual({
                outstandingPrincipal: row.closingBalance.toString(),
                difference: "0",
                matches: true,
            });
        }

        const final = await statement();
        expect(final.closingBalance).toBe("0");
        expect(final.tieOut.matches).toBe(true);
    });

    it("goes red with the exact difference when a payment is reversed but the instalments are not", async () => {
        await openLoan();
        const paymentEntry = await pay("1", "30000000", "2025-02-15");

        reverseEntry(db, BigInt(paymentEntry), "2025-02-20");
        const body = await statement();

        expect(body.lines.at(-1).description).toBe(`Reversal of entry ${paymentEntry}`);
        expect(body.closingBalance).toBe("120000000");
        expect(body.tieOut).toEqual({
            outstandingPrincipal: "100736974",
            difference: "19263026",
            matches: false,
        });
    });

    it("reads the statement from the journal and the outstanding figure from instalment state", async () => {
        await openLoan();
        const before = await statement();

        db.prepare(
            "UPDATE loan_instalments SET principal_paid = 1000 WHERE number = 1"
        ).run();
        const after = await statement();

        expect(after.lines).toEqual(before.lines);
        expect(after.closingBalance).toBe(before.closingBalance);
        expect(after.tieOut).toEqual({
            outstandingPrincipal: "119999000",
            difference: "1000",
            matches: false,
        });
    });

    it("includes only this loan's lines", async () => {
        await openLoan();
        await openLoan();
        await pay("2", "2000000", "2025-02-15");

        expect((await statement("1")).lines).toHaveLength(2);
        expect((await statement("2")).lines).toHaveLength(5);
    });

    it("returns every amount as a string", async () => {
        await openLoan();
        await pay("1", "30000000", "2025-02-15");
        const body = await statement();

        for (const line of body.lines) {
            for (const field of ["debit", "credit", "principalBalance", "entryId"]) {
                expect(typeof line[field]).toBe("string");
            }
        }
        expect(typeof body.closingBalance).toBe("string");
        expect(typeof body.tieOut.difference).toBe("string");
    });

    it("returns 404 for an unknown or malformed loan id", async () => {
        expect((await api.get("/api/loans/99/statement")).status).toBe(404);
        expect((await api.get("/api/loans/abc/statement")).status).toBe(404);
    });

    describe("GET /api/loans/:id/statement.pdf", () => {
        const download = async (loanId = "1") =>
            api.get(`/api/loans/${loanId}/statement.pdf`);

        it("downloads the statement as a PDF file named for the loan", async () => {
            await openLoan();
            await pay("1", "30000000", "2025-02-15");
            const res = await download();

            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toBe("application/pdf");
            expect(res.headers.get("content-disposition")).toBe(
                'attachment; filename="loan-1-statement.pdf"'
            );

            const bytes = Buffer.from(await res.arrayBuffer());
            expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
            const pdf = await PDFDocument.load(bytes);
            expect(pdf.getTitle()).toBe("Loan 1 statement");
            expect(pdf.getPageCount()).toBe(1);
        });

        it("spreads a long statement over several pages", async () => {
            await openLoan();
            for (let i = 0; i < 30; i++) await pay("1", "100", "2025-02-15");

            const pdf = await PDFDocument.load(
                Buffer.from(await (await download()).arrayBuffer())
            );
            expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
        });

        it("still downloads when the statement does not reconcile with the schedule", async () => {
            await openLoan();
            const entry = await pay("1", "30000000", "2025-02-15");
            reverseEntry(db, BigInt(entry), "2025-02-20");

            const res = await download();
            expect(res.status).toBe(200);
            expect(
                Buffer.from(await res.arrayBuffer())
                    .subarray(0, 5)
                    .toString()
            ).toBe("%PDF-");
        });

        it("returns 404 for an unknown or malformed loan id", async () => {
            expect((await download("99")).status).toBe(404);
            expect((await download("abc")).status).toBe(404);
        });
    });
});
