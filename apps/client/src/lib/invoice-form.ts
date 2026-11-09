import {
    type FieldError,
    type InvoiceRequest,
    parseNaira,
    type SettlementRequest,
    validateInvoiceRequest,
    validateSettlementRequest,
} from "@lending/shared";

export type InvoiceFormValues = {
    faceValue: string;
    tenorDays: string;
    fundingDate: string;
};

const merge = (errors: FieldError[], more: FieldError[]) => {
    for (const error of more) {
        if (!errors.some((existing) => existing.field === error.field))
            errors.push(error);
    }
    return errors;
};

export const toInvoiceRequest = (values: InvoiceFormValues) => {
    const errors: FieldError[] = [];

    const kobo = parseNaira(values.faceValue);
    if (kobo === null) {
        errors.push({
            field: "faceValue",
            message: /\.\d{3,}/.test(values.faceValue)
                ? "Naira amounts can have at most 2 decimal places"
                : "Enter an amount in naira, such as 1,000,000.00",
        });
    }

    const days = values.tenorDays.trim();
    const request: InvoiceRequest = {
        faceValue: kobo === null ? "" : kobo.toString(),
        tenorDays: /^\d+$/.test(days) ? Number(days) : Number.NaN,
        fundingDate: values.fundingDate,
    };
    return { request, errors: merge(errors, validateInvoiceRequest(request)) };
};

export const toSettlementRequest = (settlementDate: string, fundingDate: string) => {
    const request: SettlementRequest = { settlementDate };
    return { request, errors: validateSettlementRequest(request, { fundingDate }) };
};
