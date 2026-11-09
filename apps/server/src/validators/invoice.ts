import {
    type InvoiceRequest,
    type SettlementRequest,
    validateInvoiceRequest,
    validateSettlementRequest,
} from "@lending/shared";
import { ValidationError } from "@/lib/errors";

const asObject = <T>(body: unknown) =>
    (body !== null && typeof body === "object" ? body : {}) as Partial<T>;

export const parseInvoiceRequest = (body: unknown) => {
    const input = asObject<InvoiceRequest>(body);
    const errors = validateInvoiceRequest(input);
    if (errors.length > 0) throw new ValidationError(errors);

    return {
        faceValue: BigInt(input.faceValue as string),
        tenorDays: input.tenorDays as number,
        fundingDate: input.fundingDate as string,
    };
};

export const parseSettlementRequest = (body: unknown, fundingDate: string) => {
    const input = asObject<SettlementRequest>(body);
    const errors = validateSettlementRequest(input, { fundingDate });
    if (errors.length > 0) throw new ValidationError(errors);

    return input.settlementDate as string;
};
