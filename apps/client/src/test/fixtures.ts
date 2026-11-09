import {
    addDays,
    buildSchedule,
    type InvoiceRequest,
    type LoanRequest,
    quoteInvoice,
    settleInvoice,
} from "@lending/shared";
import type {
    InstalmentStateResponse,
    InvoiceDetailResponse,
    InvoiceQuoteResponse,
    InvoiceSummaryResponse,
    LoanDetailResponse,
    LoanSummaryResponse,
    QuoteResponse,
    SettlementResponse,
    StatementResponse,
} from "@/types/api";

export const termsRequest: LoanRequest = {
    principal: "120000000",
    annualRatePercent: "18",
    termMonths: 6,
    disbursementDate: "2025-01-15",
};

const schedule = (request: LoanRequest) =>
    buildSchedule({
        principal: BigInt(request.principal),
        annualRatePercent: request.annualRatePercent,
        termMonths: request.termMonths,
        disbursementDate: request.disbursementDate,
    });

// What the server sends for a quote: the shared schedule with every bigint as a string
export const wireQuote = (request = termsRequest, quoteId = "1"): QuoteResponse => {
    const rows = schedule(request);
    return {
        quoteId,
        totalInterest: rows.reduce((sum, row) => sum + row.interest, 0n).toString(),
        schedule: rows.map((row) => ({
            number: row.number,
            dueDate: row.dueDate,
            payment: row.payment.toString(),
            interest: row.interest.toString(),
            principal: row.principal.toString(),
            closingBalance: row.closingBalance.toString(),
        })),
    };
};

export const wireLoan = (
    paid: Partial<InstalmentStateResponse>[] = []
): LoanDetailResponse => ({
    loan: { id: "1", ...termsRequest },
    schedule: wireQuote().schedule.map((row, index) => ({
        ...row,
        penaltyDue: "0",
        feeDue: "0",
        interestPaid: "0",
        principalPaid: "0",
        penaltyPaid: "0",
        feePaid: "0",
        ...paid[index],
    })),
    entries: [
        {
            id: "1",
            kind: "disbursement",
            entryDate: "2025-01-15",
            reversesEntryId: null,
            lines: [
                {
                    account: "LOANS_RECEIVABLE",
                    accountName: "Loans Receivable",
                    side: "debit",
                    amount: "120000000",
                },
                {
                    account: "CASH",
                    accountName: "Cash",
                    side: "credit",
                    amount: "120000000",
                },
            ],
        },
    ],
});

export const invoiceRequest: InvoiceRequest = {
    faceValue: "100000000",
    tenorDays: 60,
    fundingDate: "2024-12-31",
};

// What the server sends for an invoice quote, built from the shared code
export const wireInvoiceQuote = (
    request = invoiceRequest,
    quoteId = "1"
): InvoiceQuoteResponse => {
    const quote = quoteInvoice(BigInt(request.faceValue), request.tenorDays);
    return {
        quoteId,
        faceValue: request.faceValue,
        tenorDays: request.tenorDays,
        fundingDate: request.fundingDate,
        dueDate: addDays(request.fundingDate, request.tenorDays),
        advance: quote.advance.toString(),
        reserve: quote.reserve.toString(),
        fee: quote.fee.toString(),
    };
};

const settlementOf = (
    settlementDate: string,
    request = invoiceRequest
): SettlementResponse => {
    const quote = wireInvoiceQuote(request);
    const settled = settleInvoice(
        BigInt(request.faceValue),
        request.tenorDays,
        quote.dueDate,
        settlementDate
    );
    return {
        faceValue: request.faceValue,
        dueDate: quote.dueDate,
        settlementDate,
        advance: settled.advance.toString(),
        reserve: settled.reserve.toString(),
        fee: settled.fee.toString(),
        overdueDays: settled.overdueDays,
        penalty: settled.penalty.toString(),
        payableToClient: settled.payableToClient.toString(),
        shortfall: settled.shortfall.toString(),
    };
};

export const wireSettlement = settlementOf;

export const wireInvoice = (settledOn?: string): InvoiceDetailResponse => {
    const { quoteId: _quoteId, ...invoice } = wireInvoiceQuote();
    return {
        invoice: { id: "1", ...invoice },
        settlement: settledOn ? settlementOf(settledOn) : null,
        entries: [
            {
                id: "1",
                kind: "invoice_advance",
                entryDate: "2024-12-31",
                reversesEntryId: null,
                lines: [
                    {
                        account: "INVOICE_RECEIVABLES",
                        accountName: "Invoice Receivables",
                        side: "debit",
                        amount: "80000000",
                    },
                    {
                        account: "CASH",
                        accountName: "Cash",
                        side: "credit",
                        amount: "80000000",
                    },
                ],
            },
        ],
    };
};

const line = (
    description: string,
    accountName: string,
    side: "debit" | "credit",
    amount: string,
    principalBalance: string,
    date = "2025-02-15",
    entryId = "2"
) => ({
    entryId,
    date,
    description,
    accountName,
    debit: side === "debit" ? amount : "0",
    credit: side === "credit" ? amount : "0",
    principalBalance,
});

// The loan after a 300,000.00 payment on 2025-02-15: 192,630.26 principal, 18,000.00 interest, the rest unapplied
export const wireStatement = (): StatementResponse => ({
    lines: [
        line(
            "Loan disbursement",
            "Loans Receivable",
            "debit",
            "120000000",
            "120000000",
            "2025-01-15",
            "1"
        ),
        line(
            "Loan disbursement",
            "Cash",
            "credit",
            "120000000",
            "120000000",
            "2025-01-15",
            "1"
        ),
        line("Payment received", "Cash", "debit", "30000000", "120000000"),
        line("Payment received", "Loans Receivable", "credit", "19263026", "100736974"),
        line("Payment received", "Interest Income", "credit", "1800000", "100736974"),
        line("Payment received", "Unapplied Credit", "credit", "8936974", "100736974"),
    ],
    closingBalance: "100736974",
    tieOut: { outstandingPrincipal: "100736974", difference: "0", matches: true },
});

// The same loan after the payment entry was reversed but the instalments were left alone
export const wireMismatchedStatement = (): StatementResponse => {
    const statement = wireStatement();
    return {
        ...statement,
        lines: [
            ...statement.lines,
            line(
                "Reversal of entry 2",
                "Loans Receivable",
                "debit",
                "19263026",
                "120000000",
                "2025-02-20",
                "3"
            ),
        ],
        closingBalance: "120000000",
        tieOut: {
            outstandingPrincipal: "100736974",
            difference: "19263026",
            matches: false,
        },
    };
};

// Newest first, as the server sends them: loan 2 is fully repaid, loan 1 still has principal outstanding
export const wireLoanSummaries = (): LoanSummaryResponse[] => [
    {
        id: "2",
        principal: "5000000",
        annualRatePercent: "24.5",
        termMonths: 3,
        disbursementDate: "2025-03-01",
        outstandingPrincipal: "0",
    },
    { id: "1", ...termsRequest, outstandingPrincipal: "100736974" },
];

export const wireInvoiceSummaries = (): InvoiceSummaryResponse[] => {
    const { quoteId: _quoteId, ...invoice } = wireInvoiceQuote();
    return [
        { id: "2", ...invoice, settled: true },
        {
            id: "1",
            ...invoice,
            faceValue: "50000000",
            advance: "40000000",
            reserve: "10000000",
            settled: false,
        },
    ];
};
