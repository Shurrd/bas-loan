export const ACCOUNTS = {
    CASH: { name: "Cash", type: "asset" },
    LOANS_RECEIVABLE: { name: "Loans Receivable", type: "asset" },
    INVOICE_RECEIVABLES: { name: "Invoice Receivables", type: "asset" },
    CLIENT_RECEIVABLE: { name: "Client Receivable", type: "asset" },
    INTEREST_INCOME: { name: "Interest Income", type: "income" },
    FEE_INCOME: { name: "Fee Income", type: "income" },
    PENALTY_INCOME: { name: "Penalty Income", type: "income" },
    CLIENT_PAYABLE: { name: "Client Payable", type: "liability" },
    UNAPPLIED_CREDIT: { name: "Unapplied Credit", type: "liability" },
} as const;
