import type { JournalEntryRecord } from "./loan";

export type InvoiceQuote = {
    advance: bigint;
    reserve: bigint;
    fee: bigint;
};

export type InvoiceSettlement = InvoiceQuote & {
    overdueDays: number;
    penalty: bigint;
    payableToClient: bigint;
    shortfall: bigint;
};

export type InvoiceRecord = {
    id: bigint;
    faceValue: bigint;
    tenorDays: number;
    fundingDate: string;
    dueDate: string;
    advance: bigint;
    reserve: bigint;
    fee: bigint;
};

export type InvoiceQuoteRecord = Omit<InvoiceRecord, "id"> & { quoteId: bigint };

export type InvoiceSettlementView = InvoiceSettlement & {
    faceValue: bigint;
    dueDate: string;
    settlementDate: string;
};

export type InvoiceDetail = {
    invoice: InvoiceRecord;
    settlement: InvoiceSettlementView | null;
    entries: JournalEntryRecord[];
};

export type SettlementResult = {
    settlement: InvoiceSettlementView;
    entry: JournalEntryRecord;
};

export type InvoiceSummary = InvoiceRecord & { settled: boolean };
