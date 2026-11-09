import { describe, expect, it } from "vitest";
import { validateInvoiceRequest, validateSettlementRequest } from "./invoice";

const valid = { faceValue: "100000000", tenorDays: 60, fundingDate: "2024-12-31" };

describe("validateInvoiceRequest", () => {
    it("accepts a valid request", () => {
        expect(validateInvoiceRequest(valid)).toEqual([]);
    });

    it("only accepts a positive kobo amount as a string of digits", () => {
        for (const faceValue of [100000000, "1000000.00", "-5", "0", "", "1e8", null]) {
            const errors = validateInvoiceRequest({ ...valid, faceValue });
            expect(errors.map((e) => e.field)).toEqual(["faceValue"]);
        }
        expect(
            validateInvoiceRequest({ ...valid, faceValue: "100000000000001" })[0]?.field
        ).toBe("faceValue");
    });

    it("accepts a tenor of 1 to 365 whole days only", () => {
        for (const tenorDays of [0, -1, 366, 60.5, "60", null]) {
            expect(validateInvoiceRequest({ ...valid, tenorDays })[0]?.field).toBe(
                "tenorDays"
            );
        }
        expect(validateInvoiceRequest({ ...valid, tenorDays: 1 })).toEqual([]);
        expect(validateInvoiceRequest({ ...valid, tenorDays: 365 })).toEqual([]);
    });

    it("rejects an impossible or far-off funding date", () => {
        for (const fundingDate of ["2025-02-30", "31/12/2024", "2101-01-01", 5]) {
            expect(validateInvoiceRequest({ ...valid, fundingDate })[0]?.field).toBe(
                "fundingDate"
            );
        }
    });

    it("reports every bad field at once", () => {
        expect(validateInvoiceRequest({}).map((e) => e.field)).toEqual([
            "faceValue",
            "tenorDays",
            "fundingDate",
        ]);
    });
});

describe("validateSettlementRequest", () => {
    const options = { fundingDate: "2024-12-31" };

    it("accepts the funding day and any later day", () => {
        expect(
            validateSettlementRequest({ settlementDate: "2024-12-31" }, options)
        ).toEqual([]);
        expect(
            validateSettlementRequest({ settlementDate: "2025-06-05" }, options)
        ).toEqual([]);
    });

    it("rejects a settlement before funding, with the funding date in the message", () => {
        const [error] = validateSettlementRequest(
            { settlementDate: "2024-12-30" },
            options
        );
        expect(error?.field).toBe("settlementDate");
        expect(error?.message).toContain("2024-12-31");
    });

    it("rejects an invalid or far-off date", () => {
        for (const settlementDate of ["2025-02-30", "", "2101-01-01", undefined]) {
            expect(validateSettlementRequest({ settlementDate }, options)[0]?.field).toBe(
                "settlementDate"
            );
        }
    });
});
