import { describe, expect, it } from "vitest";
import { validateLoanRequest } from "./loan";

const valid = {
    principal: "120000000",
    annualRatePercent: "18",
    termMonths: 6,
    disbursementDate: "2025-01-15",
};

describe("validateLoanRequest", () => {
    it("accepts a valid request", () => {
        expect(validateLoanRequest(valid)).toEqual([]);
    });

    it("only accepts kobo as a string of digits", () => {
        for (const principal of [
            120000000,
            "1200000.00",
            "-5",
            "",
            "1e8",
            " 100",
            null,
            undefined,
        ]) {
            const errors = validateLoanRequest({ ...valid, principal });
            expect(errors.map((e) => e.field)).toEqual(["principal"]);
        }
        expect(validateLoanRequest({ ...valid, principal: "0" })[0]?.field).toBe(
            "principal"
        );
        expect(
            validateLoanRequest({ ...valid, principal: "9223372036854775808" })[0]?.field
        ).toBe("principal");
    });

    it("checks the rate, term and date against their own fields", () => {
        expect(
            validateLoanRequest({ ...valid, annualRatePercent: "18.12345" })[0]?.field
        ).toBe("annualRatePercent");
        expect(
            validateLoanRequest({ ...valid, annualRatePercent: "100.5" })[0]?.field
        ).toBe("annualRatePercent");
        expect(validateLoanRequest({ ...valid, annualRatePercent: 18 })[0]?.field).toBe(
            "annualRatePercent"
        );
        expect(validateLoanRequest({ ...valid, termMonths: 0 })[0]?.field).toBe(
            "termMonths"
        );
        expect(validateLoanRequest({ ...valid, termMonths: 6.5 })[0]?.field).toBe(
            "termMonths"
        );
        expect(validateLoanRequest({ ...valid, termMonths: "6" })[0]?.field).toBe(
            "termMonths"
        );
        expect(
            validateLoanRequest({ ...valid, disbursementDate: "2025-02-30" })[0]?.field
        ).toBe("disbursementDate");
    });

    it("reports every bad field at once", () => {
        const errors = validateLoanRequest({});
        expect(errors.map((e) => e.field)).toEqual([
            "principal",
            "annualRatePercent",
            "termMonths",
            "disbursementDate",
        ]);
    });
});
