import { MAX_KOBO } from "../lib/constant";
import { daysBetween, isValidDate } from "../lib/date";
import type { FieldError, PaymentRequest } from "../types/api";

type Options = { disbursementDate: string; requireVersion: boolean };

export const validatePaymentRequest = (
    input: Partial<Record<keyof PaymentRequest, unknown>>,
    { disbursementDate, requireVersion }: Options
) => {
    const errors: FieldError[] = [];
    const { amount, paymentDate, stateVersion } = input;

    if (typeof amount !== "string" || !/^\d+$/.test(amount)) {
        errors.push({
            field: "amount",
            message: "Amount must be kobo as a string of digits",
        });
    } else if (BigInt(amount) === 0n) {
        errors.push({ field: "amount", message: "Amount must be greater than zero" });
    } else if (BigInt(amount) > MAX_KOBO) {
        errors.push({ field: "amount", message: "Amount is too large" });
    }

    if (typeof paymentDate !== "string" || !isValidDate(paymentDate)) {
        errors.push({
            field: "paymentDate",
            message: "Enter a valid date as YYYY-MM-DD",
        });
    } else if (daysBetween(disbursementDate, paymentDate) < 0) {
        errors.push({
            field: "paymentDate",
            message: `Payment date cannot be before the disbursement date (${disbursementDate})`,
        });
    }

    if (
        requireVersion &&
        (typeof stateVersion !== "string" || !/^\d+$/.test(stateVersion))
    ) {
        errors.push({
            field: "stateVersion",
            message: "Preview the payment again before confirming",
        });
    }
    return errors;
};
