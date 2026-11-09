import { MAX_DATE, MAX_INVOICE_KOBO } from "../lib/constant";
import { daysBetween, isValidDate } from "../lib/date";
import type { FieldError, InvoiceRequest, SettlementRequest } from "../types/api";

const MAX_TENOR_DAYS = 365;

export const validateInvoiceRequest = (
    input: Partial<Record<keyof InvoiceRequest, unknown>>
) => {
    const errors: FieldError[] = [];
    const { faceValue, tenorDays, fundingDate } = input;

    if (typeof faceValue !== "string" || !/^\d+$/.test(faceValue)) {
        errors.push({
            field: "faceValue",
            message: "Face value must be kobo as a string of digits",
        });
    } else if (BigInt(faceValue) === 0n) {
        errors.push({
            field: "faceValue",
            message: "Face value must be greater than zero",
        });
    } else if (BigInt(faceValue) > MAX_INVOICE_KOBO) {
        errors.push({ field: "faceValue", message: "Face value is too large" });
    }

    if (
        typeof tenorDays !== "number" ||
        !Number.isInteger(tenorDays) ||
        tenorDays < 1 ||
        tenorDays > MAX_TENOR_DAYS
    ) {
        errors.push({
            field: "tenorDays",
            message: `Tenor must be a whole number of days from 1 to ${MAX_TENOR_DAYS}`,
        });
    }

    if (typeof fundingDate !== "string" || !isValidDate(fundingDate)) {
        errors.push({
            field: "fundingDate",
            message: "Enter a valid date as YYYY-MM-DD",
        });
    } else if (fundingDate > MAX_DATE) {
        errors.push({
            field: "fundingDate",
            message: `Funding date cannot be after ${MAX_DATE}`,
        });
    }

    return errors;
};

export const validateSettlementRequest = (
    input: Partial<Record<keyof SettlementRequest, unknown>>,
    { fundingDate }: { fundingDate: string }
) => {
    const errors: FieldError[] = [];
    const { settlementDate } = input;

    if (typeof settlementDate !== "string" || !isValidDate(settlementDate)) {
        errors.push({
            field: "settlementDate",
            message: "Enter a valid date as YYYY-MM-DD",
        });
    } else if (daysBetween(fundingDate, settlementDate) < 0) {
        errors.push({
            field: "settlementDate",
            message: `Settlement date cannot be before the funding date (${fundingDate})`,
        });
    } else if (settlementDate > MAX_DATE) {
        errors.push({
            field: "settlementDate",
            message: `Settlement date cannot be after ${MAX_DATE}`,
        });
    }

    return errors;
};
