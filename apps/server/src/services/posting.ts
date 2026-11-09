import type { InvoiceSettlement } from "@lending/shared";
import type { AccountCode, LedgerLine, PaymentParts } from "@/types/ledger";

const debit = (account: AccountCode, amount: bigint): LedgerLine => ({
    account,
    side: "debit",
    amount,
});

const credit = (account: AccountCode, amount: bigint): LedgerLine => ({
    account,
    side: "credit",
    amount,
});

export const disbursementLines = (principal: bigint) => [
    debit("LOANS_RECEIVABLE", principal),
    credit("CASH", principal),
];

export const paymentLines = (parts: PaymentParts) => {
    const received =
        parts.principal + parts.interest + parts.penalty + parts.fee + parts.unapplied;
    return [
        debit("CASH", received),
        credit("LOANS_RECEIVABLE", parts.principal),
        credit("INTEREST_INCOME", parts.interest),
        credit("PENALTY_INCOME", parts.penalty),
        credit("FEE_INCOME", parts.fee),
        credit("UNAPPLIED_CREDIT", parts.unapplied),
    ];
};

export const invoiceAdvanceLines = (advance: bigint) => [
    debit("INVOICE_RECEIVABLES", advance),
    credit("CASH", advance),
];

// The debtor pays the face value. A shortfall is a Client Receivable debit instead of a payable credit.
export const invoiceSettlementLines = (
    faceValue: bigint,
    settlement: InvoiceSettlement
) => [
    debit("CASH", faceValue),
    debit("CLIENT_RECEIVABLE", settlement.shortfall),
    credit("INVOICE_RECEIVABLES", settlement.advance),
    credit("FEE_INCOME", settlement.fee),
    credit("PENALTY_INCOME", settlement.penalty),
    credit("CLIENT_PAYABLE", settlement.payableToClient),
];
