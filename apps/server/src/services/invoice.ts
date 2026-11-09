import {
    type InvoiceDetail,
    type InvoiceRecord,
    type InvoiceSummary,
    type InvoiceSettlementView,
    type SettlementResult,
    settleInvoice,
} from "@lending/shared";
import type { Db } from "@/db";
import { LIST_LIMIT } from "@/lib/constant";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { getJournalEntries } from "@/services/loan";
import { postEntry } from "@/services/ledger";
import { invoiceAdvanceLines, invoiceSettlementLines } from "@/services/posting";
import { getInvoiceQuote } from "@/services/invoice-quote";

type InvoiceRow = {
    id: bigint;
    face_value: bigint;
    tenor_days: bigint;
    funding_date: string;
    due_date: string;
    advance: bigint;
    reserve: bigint;
    fee: bigint;
};

// Copies the saved quote, so the client can never change the terms at funding
export const createInvoice = (db: Db, quoteId: bigint) =>
    BigInt(
        db
            .prepare(
                `INSERT INTO invoices
                 (quote_id, face_value, tenor_days, funding_date, due_date, advance, reserve, fee)
                 SELECT id, face_value, tenor_days, funding_date, due_date, advance, reserve, fee
                 FROM invoice_quotes WHERE id = ?`
            )
            .run(quoteId).lastInsertRowid
    );

// The invoice and its advance entry are written together or not at all
export const fundInvoice = (db: Db, quoteId: bigint) =>
    db.transaction((): InvoiceDetail => {
        const quote = getInvoiceQuote(db, quoteId);

        const existing = db
            .prepare("SELECT id FROM invoices WHERE quote_id = ?")
            .get(quoteId) as { id: bigint } | undefined;
        if (existing) {
            throw new ConflictError("This quote has already been funded", {
                invoiceId: existing.id.toString(),
            });
        }

        const invoiceId = createInvoice(db, quoteId);
        postEntry(db, {
            kind: "invoice_advance",
            entryDate: quote.fundingDate,
            invoiceId,
            lines: invoiceAdvanceLines(quote.advance),
        });
        return getInvoiceDetail(db, invoiceId);
    })();

export const getInvoiceRecord = (db: Db, invoiceId: bigint): InvoiceRecord => {
    const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId) as
        InvoiceRow | undefined;
    if (!row) throw new NotFoundError("Invoice not found");

    return {
        id: row.id,
        faceValue: row.face_value,
        tenorDays: Number(row.tenor_days),
        fundingDate: row.funding_date,
        dueDate: row.due_date,
        advance: row.advance,
        reserve: row.reserve,
        fee: row.fee,
    };
};

const settlementView = (
    invoice: InvoiceRecord,
    settlementDate: string
): InvoiceSettlementView => ({
    ...settleInvoice(
        invoice.faceValue,
        invoice.tenorDays,
        invoice.dueDate,
        settlementDate
    ),
    faceValue: invoice.faceValue,
    dueDate: invoice.dueDate,
    settlementDate,
});

const findSettlementDate = (db: Db, invoiceId: bigint) =>
    (
        db
            .prepare(
                "SELECT entry_date FROM journal_entries WHERE invoice_id = ? AND kind = 'invoice_settlement'"
            )
            .get(invoiceId) as { entry_date: string } | undefined
    )?.entry_date;

export const getInvoiceDetail = (db: Db, invoiceId: bigint): InvoiceDetail => {
    const invoice = getInvoiceRecord(db, invoiceId);
    const settledOn = findSettlementDate(db, invoiceId);
    return {
        invoice,
        settlement: settledOn ? settlementView(invoice, settledOn) : null,
        entries: getJournalEntries(db, "invoice_id", invoiceId),
    };
};

export const previewSettlement = (db: Db, invoiceId: bigint, settlementDate: string) => ({
    settlement: settlementView(getInvoiceRecord(db, invoiceId), settlementDate),
});

// The debtor always pays the face value, so the request carries only a date.
// The figures are recomputed here from the saved invoice, never taken from the client.
export const confirmSettlement = (db: Db, invoiceId: bigint, settlementDate: string) =>
    db.transaction((): SettlementResult => {
        if (findSettlementDate(db, invoiceId)) {
            throw new ConflictError("This invoice has already been settled", {
                code: "ALREADY_SETTLED",
                invoiceId: invoiceId.toString(),
            });
        }

        const invoice = getInvoiceRecord(db, invoiceId);
        const settlement = settlementView(invoice, settlementDate);
        const entryId = postEntry(db, {
            kind: "invoice_settlement",
            entryDate: settlementDate,
            invoiceId,
            lines: invoiceSettlementLines(invoice.faceValue, settlement),
        });
        return { settlement, entry: getJournalEntries(db, "id", entryId)[0]! };
    })();

export const listInvoices = (db: Db): InvoiceSummary[] =>
    (
        db
            .prepare(
                `SELECT i.*,
                        EXISTS (
                            SELECT 1 FROM journal_entries e
                            WHERE e.invoice_id = i.id AND e.kind = 'invoice_settlement'
                        ) AS settled
                 FROM invoices i ORDER BY i.id DESC LIMIT ?`
            )
            .all(LIST_LIMIT) as (InvoiceRow & { settled: bigint })[]
    ).map((row) => ({
        id: row.id,
        faceValue: row.face_value,
        tenorDays: Number(row.tenor_days),
        fundingDate: row.funding_date,
        dueDate: row.due_date,
        advance: row.advance,
        reserve: row.reserve,
        fee: row.fee,
        settled: row.settled === 1n,
    }));
