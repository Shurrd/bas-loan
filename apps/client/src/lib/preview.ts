import {
    addDays,
    buildSchedule,
    type InvoiceRequest,
    type LoanRequest,
    quoteInvoice,
} from "@lending/shared";
import type { InstalmentResponse, InvoiceQuoteResponse } from "@/types/api";

export type Mismatch = {
    instalment: number;
    field: string;
    preview: string;
    server: string;
};

const MONEY_FIELDS = ["payment", "interest", "principal", "closingBalance"] as const;

// The preview is built on this device from the same shared code. The server's quote is the official one.
export const findScheduleMismatches = (
    request: LoanRequest,
    server: InstalmentResponse[]
) => {
    const preview = buildSchedule({
        principal: BigInt(request.principal),
        annualRatePercent: request.annualRatePercent,
        termMonths: request.termMonths,
        disbursementDate: request.disbursementDate,
    });

    const mismatches: Mismatch[] = [];
    if (preview.length !== server.length) {
        mismatches.push({
            instalment: 0,
            field: "instalments",
            preview: String(preview.length),
            server: String(server.length),
        });
    }

    preview.forEach((row, index) => {
        const other = server[index];
        if (!other) return;

        if (row.dueDate !== other.dueDate) {
            mismatches.push({
                instalment: row.number,
                field: "dueDate",
                preview: row.dueDate,
                server: other.dueDate,
            });
        }
        for (const field of MONEY_FIELDS) {
            if (row[field] !== BigInt(other[field])) {
                mismatches.push({
                    instalment: row.number,
                    field,
                    preview: row[field].toString(),
                    server: other[field],
                });
            }
        }
    });
    return mismatches;
};

export type InvoiceMismatch = { field: string; preview: string; server: string };

// Same check for an invoice quote: advance, reserve, fee and due date worked out here against the server's
export const findInvoiceMismatches = (
    request: InvoiceRequest,
    server: InvoiceQuoteResponse
) => {
    const preview = quoteInvoice(BigInt(request.faceValue), request.tenorDays);
    const expected = {
        advance: preview.advance.toString(),
        reserve: preview.reserve.toString(),
        fee: preview.fee.toString(),
        dueDate: addDays(request.fundingDate, request.tenorDays),
    };

    const mismatches: InvoiceMismatch[] = [];
    for (const field of ["advance", "reserve", "fee", "dueDate"] as const) {
        if (expected[field] !== server[field]) {
            mismatches.push({ field, preview: expected[field], server: server[field] });
        }
    }
    return mismatches;
};
