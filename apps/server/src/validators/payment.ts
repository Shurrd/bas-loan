import { type PaymentRequest, validatePaymentRequest } from "@lending/shared";
import { ValidationError } from "@/lib/errors";

export const parsePaymentRequest = (
    body: unknown,
    disbursementDate: string,
    requireVersion: boolean
) => {
    const input = (
        body !== null && typeof body === "object" ? body : {}
    ) as Partial<PaymentRequest>;
    const errors = validatePaymentRequest(input, { disbursementDate, requireVersion });
    if (errors.length > 0) throw new ValidationError(errors);

    return {
        amount: BigInt(input.amount as string),
        paymentDate: input.paymentDate as string,
        stateVersion: input.stateVersion === undefined ? 0n : BigInt(input.stateVersion),
    };
};
