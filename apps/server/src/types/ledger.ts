import type { ACCOUNTS } from "@/lib/constant";

export type AccountCode = keyof typeof ACCOUNTS;

export type EntryKind =
    "disbursement" | "payment" | "invoice_advance" | "invoice_settlement" | "reversal";

export type LedgerLine = {
    account: AccountCode;
    side: "debit" | "credit";
    amount: bigint;
};

export type NewEntry = {
    kind: EntryKind;
    entryDate: string;
    loanId?: bigint;
    invoiceId?: bigint;
    reversesEntryId?: bigint;
    lines: LedgerLine[];
};

export type PaymentParts = {
    principal: bigint;
    interest: bigint;
    penalty: bigint;
    fee: bigint;
    unapplied: bigint;
};
