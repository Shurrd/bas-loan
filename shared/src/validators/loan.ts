import { MAX_KOBO } from "../lib/constant";
import { isValidDate } from "../lib/date";
import { parseRate } from "../lib/rate";
import type { FieldError, LoanRequest } from "../types/api";

const MAX_TERM_MONTHS = 120;

export const validateLoanRequest = (
    input: Partial<Record<keyof LoanRequest, unknown>>
) => {
    const errors: FieldError[] = [];
    const { principal, annualRatePercent, termMonths, disbursementDate } = input;

    if (typeof principal !== "string" || !/^\d+$/.test(principal)) {
        errors.push({
            field: "principal",
            message: "Principal must be kobo as a string of digits",
        });
    } else if (BigInt(principal) === 0n) {
        errors.push({
            field: "principal",
            message: "Principal must be greater than zero",
        });
    } else if (BigInt(principal) > MAX_KOBO) {
        errors.push({ field: "principal", message: "Principal is too large" });
    }

    if (
        typeof annualRatePercent !== "string" ||
        !/^\d{1,3}(\.\d{1,4})?$/.test(annualRatePercent)
    ) {
        errors.push({
            field: "annualRatePercent",
            message:
                "Rate must be a percentage with at most 4 decimal places, such as 18.75",
        });
    } else {
        const rate = parseRate(annualRatePercent);
        if (rate.numerator > rate.denominator) {
            errors.push({
                field: "annualRatePercent",
                message: "Rate cannot be more than 100",
            });
        }
    }

    if (
        typeof termMonths !== "number" ||
        !Number.isInteger(termMonths) ||
        termMonths < 1 ||
        termMonths > MAX_TERM_MONTHS
    ) {
        errors.push({
            field: "termMonths",
            message: `Term must be a whole number of months from 1 to ${MAX_TERM_MONTHS}`,
        });
    }

    if (typeof disbursementDate !== "string" || !isValidDate(disbursementDate)) {
        errors.push({
            field: "disbursementDate",
            message: "Enter a valid date as YYYY-MM-DD",
        });
    }

    return errors;
};
