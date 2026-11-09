export type StatementLine = {
    entryId: bigint;
    date: string;
    description: string;
    accountName: string;
    debit: bigint;
    credit: bigint;
    principalBalance: bigint;
};

export type TieOut = {
    outstandingPrincipal: bigint;
    difference: bigint;
    matches: boolean;
};

export type Statement = {
    lines: StatementLine[];
    closingBalance: bigint;
    tieOut: TieOut;
};
