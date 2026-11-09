import type {
    InvoiceRequest,
    LoanRequest,
    PaymentRequest,
    SettlementRequest,
} from "@lending/shared";
import { fileNameFromDisposition } from "@/lib/download";
import { httpClient } from "@/lib/http-client";
import type {
    InvoiceDetailResponse,
    InvoiceQuoteResponse,
    InvoiceSummaryResponse,
    LoanDetailResponse,
    LoanSummaryResponse,
    PaymentPreviewResponse,
    PaymentResultResponse,
    QuoteResponse,
    SettlementPreviewResponse,
    SettlementResultResponse,
    StatementResponse,
} from "@/types/api";

export const quoteLoan = async (body: LoanRequest) =>
    (await httpClient.post<QuoteResponse>("/api/loans/quote", body)).data;

export const createLoan = async ({ quoteId, key }: { quoteId: string; key: string }) =>
    (
        await httpClient.post<LoanDetailResponse>(
            "/api/loans",
            { quoteId },
            { headers: { "Idempotency-Key": key } }
        )
    ).data;

export const getLoan = async (id: string) =>
    (await httpClient.get<LoanDetailResponse>(`/api/loans/${id}`)).data;

export const previewPayment = async ({
    loanId,
    body,
}: {
    loanId: string;
    body: PaymentRequest;
}) =>
    (
        await httpClient.post<PaymentPreviewResponse>(
            `/api/loans/${loanId}/payments/preview`,
            body
        )
    ).data;

export const confirmPayment = async ({
    loanId,
    body,
    key,
}: {
    loanId: string;
    body: PaymentRequest;
    key: string;
}) =>
    (
        await httpClient.post<PaymentResultResponse>(
            `/api/loans/${loanId}/payments`,
            body,
            {
                headers: { "Idempotency-Key": key },
            }
        )
    ).data;

export const quoteInvoice = async (body: InvoiceRequest) =>
    (await httpClient.post<InvoiceQuoteResponse>("/api/invoices/quote", body)).data;

export const createInvoice = async ({ quoteId, key }: { quoteId: string; key: string }) =>
    (
        await httpClient.post<InvoiceDetailResponse>(
            "/api/invoices",
            { quoteId },
            { headers: { "Idempotency-Key": key } }
        )
    ).data;

export const getInvoice = async (id: string) =>
    (await httpClient.get<InvoiceDetailResponse>(`/api/invoices/${id}`)).data;

export const previewSettlement = async ({
    invoiceId,
    body,
}: {
    invoiceId: string;
    body: SettlementRequest;
}) =>
    (
        await httpClient.post<SettlementPreviewResponse>(
            `/api/invoices/${invoiceId}/settlement/preview`,
            body
        )
    ).data;

export const confirmSettlement = async ({
    invoiceId,
    body,
    key,
}: {
    invoiceId: string;
    body: SettlementRequest;
    key: string;
}) =>
    (
        await httpClient.post<SettlementResultResponse>(
            `/api/invoices/${invoiceId}/settlement`,
            body,
            {
                headers: { "Idempotency-Key": key },
            }
        )
    ).data;

export const getStatement = async (loanId: string) =>
    (await httpClient.get<StatementResponse>(`/api/loans/${loanId}/statement`)).data;

export const getLoans = async () =>
    (await httpClient.get<LoanSummaryResponse[]>("/api/loans")).data;

export const getInvoices = async () =>
    (await httpClient.get<InvoiceSummaryResponse[]>("/api/invoices")).data;

export const downloadStatementPdf = async (loanId: string) => {
    const response = await httpClient.get<Blob>(`/api/loans/${loanId}/statement.pdf`, {
        responseType: "blob",
    });
    return {
        blob: response.data,
        fileName: fileNameFromDisposition(
            response.headers["content-disposition"],
            `loan-${loanId}-statement.pdf`
        ),
    };
};
