export type InvoiceQuote = {
    advance: bigint;
    reserve: bigint;
    fee: bigint;
};

export type InvoiceSettlement = InvoiceQuote & {
    overdueDays: number;
    penalty: bigint;
    payableToClient: bigint;
    shortfall: bigint;
};
