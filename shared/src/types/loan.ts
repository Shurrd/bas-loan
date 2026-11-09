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
