import {
    type FieldError,
    type PaymentRequest,
    parseNaira,
    validatePaymentRequest,
} from "@lending/shared";

export type PaymentFormValues = {
    amount: string;
    paymentDate: string;
};

export const toPaymentRequest = (values: PaymentFormValues, disbursementDate: string) => {
    const errors: FieldError[] = [];

    const kobo = parseNaira(values.amount);
    if (kobo === null) {
        errors.push({
            field: "amount",
            message: /\.\d{3,}/.test(values.amount)
                ? "Naira amounts can have at most 2 decimal places"
                : "Enter an amount in naira, such as 50,000.00",
        });
    }

    const request: PaymentRequest = {
        amount: kobo === null ? "" : kobo.toString(),
        paymentDate: values.paymentDate,
    };

    for (const error of validatePaymentRequest(request, {
        disbursementDate,
        requireVersion: false,
    })) {
        if (!errors.some((existing) => existing.field === error.field))
            errors.push(error);
    }
    return { request, errors };
};
