import { buildSchedule, settleInvoice } from "@lending/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { type Db, openDatabase } from "@/db";
import { getEntryLines, postEntry } from "@/services/ledger";
import { createInvoice } from "@/services/invoice";
import { createLoan } from "@/services/loan";
import { disbursementLines, invoiceSettlementLines } from "@/services/posting";

describe("loan disbursement", () => {
    it("posts Worked Example 1 as Dr Loans Receivable, Cr Cash for 120,000,000", () => {
        const db = openDatabase();
        const terms = {
            principal: 120_000_000n,
            annualRatePercent: "18",
            termMonths: 6,
            disbursementDate: "2025-01-15",
        };
        expect(buildSchedule(terms)).toHaveLength(6);

        const loanId = createLoan(db, terms);
        const entryId = postEntry(db, {
            kind: "disbursement",
            entryDate: terms.disbursementDate,
            loanId,
            lines: disbursementLines(terms.principal),
        });

        expect(getEntryLines(db, entryId)).toEqual([
            { account: "LOANS_RECEIVABLE", side: "debit", amount: 120_000_000n },
            { account: "CASH", side: "credit", amount: 120_000_000n },
        ]);
    });
});

describe("invoice settlement", () => {
    let db: Db;
    let invoiceId: bigint;

    const settle = (faceValue: bigint, tenorDays: number, settlementDate: string) => {
        const settlement = settleInvoice(
            faceValue,
            tenorDays,
            "2025-03-01",
            settlementDate
        );
        const entryId = postEntry(db, {
            kind: "invoice_settlement",
            entryDate: settlementDate,
            invoiceId,
            lines: invoiceSettlementLines(faceValue, settlement),
        });
        return getEntryLines(db, entryId);
    };

    const invoice = (faceValue: bigint, tenorDays: number) =>
        createInvoice(db, {
            faceValue,
            tenorDays,
            advanceDate: "2024-12-31",
            dueDate: "2025-03-01",
        });

    beforeEach(() => {
        db = openDatabase();
    });

    it("posts the shortfall example exactly as in the brief", () => {
        invoiceId = invoice(100_000_000n, 60);
        expect(settle(100_000_000n, 60, "2025-06-05")).toEqual([
            { account: "CASH", side: "debit", amount: 100_000_000n },
            { account: "CLIENT_RECEIVABLE", side: "debit", amount: 94_247n },
            { account: "INVOICE_RECEIVABLES", side: "credit", amount: 80_000_000n },
            { account: "FEE_INCOME", side: "credit", amount: 4_734_247n },
            { account: "PENALTY_INCOME", side: "credit", amount: 15_360_000n },
        ]);
    });

    it("credits Client Payable and posts no Client Receivable on a normal settlement", () => {
        invoiceId = invoice(100_000_000n, 60);
        const lines = settle(100_000_000n, 60, "2025-03-01");
        expect(lines).toEqual([
            { account: "CASH", side: "debit", amount: 100_000_000n },
            { account: "INVOICE_RECEIVABLES", side: "credit", amount: 80_000_000n },
            { account: "FEE_INCOME", side: "credit", amount: 4_734_247n },
            { account: "CLIENT_PAYABLE", side: "credit", amount: 15_265_753n },
        ]);
    });

    it("posts neither Client Payable nor Client Receivable when charges equal the reserve", () => {
        invoiceId = invoice(100_000_000n, 0);
        const lines = settle(100_000_000n, 0, "2025-07-04");
        expect(lines).toEqual([
            { account: "CASH", side: "debit", amount: 100_000_000n },
            { account: "INVOICE_RECEIVABLES", side: "credit", amount: 80_000_000n },
            { account: "PENALTY_INCOME", side: "credit", amount: 20_000_000n },
        ]);
    });
});
