import {
    type FieldError,
    type LoanRequest,
    parseNaira,
    validateLoanRequest,
} from "@lending/shared";

export type LoanFormValues = {
    principal: string;
    annualRatePercent: string;
    termMonths: string;
    disbursementDate: string;
};

export const toLoanRequest = (values: LoanFormValues) => {
    const errors: FieldError[] = [];

    const kobo = parseNaira(values.principal);
    if (kobo === null) {
        errors.push({
            field: "principal",
            message: /\.\d{3,}/.test(values.principal)
                ? "Naira amounts can have at most 2 decimal places"
                : "Enter an amount in naira, such as 1,200,000.00",
        });
    }

    const months = values.termMonths.trim();
    const request: LoanRequest = {
        principal: kobo === null ? "" : kobo.toString(),
        annualRatePercent: values.annualRatePercent.trim(),
        termMonths: /^\d+$/.test(months) ? Number(months) : Number.NaN,
        disbursementDate: values.disbursementDate,
    };

    for (const error of validateLoanRequest(request)) {
        if (!errors.some((existing) => existing.field === error.field))
            errors.push(error);
    }
    return { request, errors };
};
