import { addDays, type InvoiceQuoteRecord, quoteInvoice } from "@lending/shared";
import type { Db } from "@/db";
import { NotFoundError } from "@/lib/errors";

type QuoteRow = {
    id: bigint;
    face_value: bigint;
    tenor_days: bigint;
    funding_date: string;
    due_date: string;
    advance: bigint;
    reserve: bigint;
    fee: bigint;
};

type NewInvoiceQuote = { faceValue: bigint; tenorDays: number; fundingDate: string };

// Saves the advance, reserve and fee only. Nothing is posted until the quote is funded.
export const saveInvoiceQuote = (db: Db, input: NewInvoiceQuote): InvoiceQuoteRecord => {
    const { advance, reserve, fee } = quoteInvoice(input.faceValue, input.tenorDays);
    const dueDate = addDays(input.fundingDate, input.tenorDays);

    const quoteId = BigInt(
        db
            .prepare(
                `INSERT INTO invoice_quotes
                 (face_value, tenor_days, funding_date, due_date, advance, reserve, fee)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
                input.faceValue,
                input.tenorDays,
                input.fundingDate,
                dueDate,
                advance,
                reserve,
                fee
            ).lastInsertRowid
    );
    return { quoteId, ...input, dueDate, advance, reserve, fee };
};

export const getInvoiceQuote = (db: Db, quoteId: bigint): InvoiceQuoteRecord => {
    const row = db.prepare("SELECT * FROM invoice_quotes WHERE id = ?").get(quoteId) as
        QuoteRow | undefined;
    if (!row) throw new NotFoundError("Quote not found");

    return {
        quoteId: row.id,
        faceValue: row.face_value,
        tenorDays: Number(row.tenor_days),
        fundingDate: row.funding_date,
        dueDate: row.due_date,
        advance: row.advance,
        reserve: row.reserve,
        fee: row.fee,
    };
};
