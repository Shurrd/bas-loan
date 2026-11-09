export type Wire<T> = T extends bigint
    ? string
    : T extends (infer U)[]
      ? Wire<U>[]
      : T extends object
        ? { [K in keyof T]: Wire<T[K]> }
        : T;

export type FieldError = {
    field: string;
    message: string;
};

export type ErrorResponse = {
    errors: FieldError[];
};

export type LoanRequest = {
    principal: string;
    annualRatePercent: string;
    termMonths: number;
    disbursementDate: string;
};

export type PaymentRequest = {
    amount: string;
    paymentDate: string;
    stateVersion?: string;
};

export type InvoiceRequest = {
    faceValue: string;
    tenorDays: number;
    fundingDate: string;
};

export type SettlementRequest = {
    settlementDate: string;
};
