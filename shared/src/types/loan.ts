export type LoanTerms = {
    principal: bigint;
    annualRatePercent: string;
    termMonths: number;
    disbursementDate: string;
};

export type Instalment = {
    number: number;
    dueDate: string;
    payment: bigint;
    interest: bigint;
    principal: bigint;
    closingBalance: bigint;
};

export type LoanRecord = {
    id: bigint;
    principal: bigint;
    annualRatePercent: string;
    termMonths: number;
    disbursementDate: string;
};

export type JournalEntryRecord = {
    id: bigint;
    kind: string;
    entryDate: string;
    reversesEntryId: bigint | null;
    lines: {
        account: string;
        accountName: string;
        side: "debit" | "credit";
        amount: bigint;
    }[];
};

export type LoanQuote = {
    quoteId: bigint;
    schedule: Instalment[];
    totalInterest: bigint;
};

export type InstalmentState = Instalment & {
    penaltyDue: bigint;
    feeDue: bigint;
    interestPaid: bigint;
    principalPaid: bigint;
    penaltyPaid: bigint;
    feePaid: bigint;
};

export type LoanDetail = {
    loan: LoanRecord;
    schedule: InstalmentState[];
    entries: JournalEntryRecord[];
};

export type LoanSummary = LoanRecord & { outstandingPrincipal: bigint };
