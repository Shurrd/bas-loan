import { describe, expect, it } from "vitest";
import { toLoanRequest } from "./loan-form";

const values = {
    principal: "1,200,000.00",
    annualRatePercent: "18",
    termMonths: "6",
    disbursementDate: "2025-01-15",
};

describe("toLoanRequest", () => {
    it("turns naira text into a kobo string and the term into a number", () => {
        const { request, errors } = toLoanRequest(values);
        expect(errors).toEqual([]);
        expect(request).toEqual({
            principal: "120000000",
            annualRatePercent: "18",
            termMonths: 6,
            disbursementDate: "2025-01-15",
        });
    });

    it("rejects more than 2 decimal places against the principal field", () => {
        const { errors } = toLoanRequest({ ...values, principal: "1000.505" });
        expect(errors).toEqual([
            {
                field: "principal",
                message: "Naira amounts can have at most 2 decimal places",
            },
        ]);
    });

    it("reports a bad principal once, not twice", () => {
        const { errors } = toLoanRequest({ ...values, principal: "abc" });
        expect(errors.filter((e) => e.field === "principal")).toHaveLength(1);
    });

    it("reports a term that is not a whole number", () => {
        for (const termMonths of ["", "six", "6.5", "-1"]) {
            const { errors } = toLoanRequest({ ...values, termMonths });
            expect(errors.map((e) => e.field)).toEqual(["termMonths"]);
        }
    });
});
