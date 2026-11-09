import { type LoanRequest, type LoanTerms, validateLoanRequest } from "@lending/shared";
import { ValidationError } from "@/lib/errors";

export const parseLoanRequest = (body: unknown): LoanTerms => {
    const input = (
        body !== null && typeof body === "object" ? body : {}
    ) as Partial<LoanRequest>;
    const errors = validateLoanRequest(input);
    if (errors.length > 0) throw new ValidationError(errors);

    return {
        principal: BigInt(input.principal as string),
        annualRatePercent: input.annualRatePercent as string,
        termMonths: input.termMonths as number,
        disbursementDate: input.disbursementDate as string,
    };
};

export const parseApprovalRequest = (body: unknown) => {
    const quoteId = (body as { quoteId?: unknown } | null)?.quoteId;
    if (typeof quoteId !== "string" || !/^\d+$/.test(quoteId)) {
        throw new ValidationError([
            { field: "quoteId", message: "Quote id must be a string of digits" },
        ]);
    }
    return BigInt(quoteId);
};
