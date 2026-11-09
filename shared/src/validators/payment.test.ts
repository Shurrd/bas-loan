import { describe, expect, it } from "vitest";
import { validatePaymentRequest } from "./payment";

const options = { disbursementDate: "2025-01-15", requireVersion: true };
const valid = { amount: "500000", paymentDate: "2025-02-15", stateVersion: "1" };

describe("validatePaymentRequest", () => {
    it("accepts a valid request", () => {
        expect(validatePaymentRequest(valid, options)).toEqual([]);
    });

    it("rejects zero and anything that is not a digit string", () => {
        for (const amount of ["0", "-5", "10.50", "", 500000, null]) {
            const errors = validatePaymentRequest({ ...valid, amount }, options);
            expect(errors.map((e) => e.field)).toEqual(["amount"]);
        }
    });

    it("rejects a payment date before disbursement but allows the disbursement day", () => {
        expect(
            validatePaymentRequest({ ...valid, paymentDate: "2025-01-14" }, options)[0]
                ?.field
        ).toBe("paymentDate");
        expect(
            validatePaymentRequest({ ...valid, paymentDate: "2025-01-15" }, options)
        ).toEqual([]);
        expect(
            validatePaymentRequest({ ...valid, paymentDate: "2025-02-30" }, options)[0]
                ?.field
        ).toBe("paymentDate");
    });

    it("needs the state version only when confirming", () => {
        const { stateVersion: _omit, ...preview } = valid;
        expect(
            validatePaymentRequest(preview, { ...options, requireVersion: false })
        ).toEqual([]);
        expect(validatePaymentRequest(preview, options).map((e) => e.field)).toEqual([
            "stateVersion",
        ]);
    });
});
