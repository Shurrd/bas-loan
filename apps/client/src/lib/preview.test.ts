import { describe, expect, it } from "vitest";
import {
    invoiceRequest,
    termsRequest,
    wireInvoiceQuote,
    wireQuote,
} from "@/test/fixtures";
import { findInvoiceMismatches, findScheduleMismatches } from "./preview";

describe("findScheduleMismatches", () => {
    it("finds nothing when the server quote matches the preview to the kobo", () => {
        expect(findScheduleMismatches(termsRequest, wireQuote().schedule)).toEqual([]);
    });

    it("reports a single kobo of difference with the instalment and the field", () => {
        const { schedule } = wireQuote();
        schedule[2]!.interest = String(BigInt(schedule[2]!.interest) + 1n);

        expect(findScheduleMismatches(termsRequest, schedule)).toEqual([
            { instalment: 3, field: "interest", preview: "1217775", server: "1217776" },
        ]);
    });

    it("reports every differing field, including a changed due date", () => {
        const { schedule } = wireQuote();
        schedule[0]!.payment = "21063027";
        schedule[5]!.closingBalance = "1";
        schedule[1]!.dueDate = "2025-03-16";

        const found = findScheduleMismatches(termsRequest, schedule).map((m) => [
            m.instalment,
            m.field,
        ]);
        expect(found).toEqual([
            [1, "payment"],
            [2, "dueDate"],
            [6, "closingBalance"],
        ]);
    });

    it("reports a server schedule with a different number of instalments", () => {
        const { schedule } = wireQuote();
        const found = findScheduleMismatches(termsRequest, schedule.slice(0, 5));
        expect(found[0]).toEqual({
            instalment: 0,
            field: "instalments",
            preview: "6",
            server: "5",
        });
    });
});

describe("findInvoiceMismatches", () => {
    it("finds nothing when the server quote matches the preview to the kobo", () => {
        expect(findInvoiceMismatches(invoiceRequest, wireInvoiceQuote())).toEqual([]);
    });

    it("reports a single kobo of difference in the fee", () => {
        const quote = { ...wireInvoiceQuote(), fee: "4734248" };
        expect(findInvoiceMismatches(invoiceRequest, quote)).toEqual([
            { field: "fee", preview: "4734247", server: "4734248" },
        ]);
    });

    it("reports a different advance, reserve and due date together", () => {
        const quote = {
            ...wireInvoiceQuote(),
            advance: "80000001",
            reserve: "19999999",
            dueDate: "2025-03-02",
        };
        expect(findInvoiceMismatches(invoiceRequest, quote).map((m) => m.field)).toEqual([
            "advance",
            "reserve",
            "dueDate",
        ]);
    });
});
