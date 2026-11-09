import type {
    InvoiceDetail,
    InvoiceQuoteRecord,
    InvoiceSummary,
    InvoiceSettlementView,
    LoanDetail,
    LoanQuote,
    LoanSummary,
    PaymentPreview,
    PaymentResult,
    SettlementResult,
    Statement,
    Wire,
} from "@lending/shared";

export type QuoteResponse = Wire<LoanQuote>;
export type InstalmentResponse = QuoteResponse["schedule"][number];
export type LoanDetailResponse = Wire<LoanDetail>;
export type InstalmentStateResponse = LoanDetailResponse["schedule"][number];
export type PaymentPreviewResponse = Wire<PaymentPreview>;
export type PaymentResultResponse = Wire<PaymentResult>;

export type InvoiceQuoteResponse = Wire<InvoiceQuoteRecord>;
export type InvoiceDetailResponse = Wire<InvoiceDetail>;
export type SettlementResponse = Wire<InvoiceSettlementView>;
export type SettlementPreviewResponse = { settlement: SettlementResponse };
export type SettlementResultResponse = Wire<SettlementResult>;

export type StatementResponse = Wire<Statement>;

export type LoanSummaryResponse = Wire<LoanSummary>;
export type InvoiceSummaryResponse = Wire<InvoiceSummary>;
