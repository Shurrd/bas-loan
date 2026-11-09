import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Db, openDatabase } from "@/db";
import { LIST_LIMIT } from "@/lib/constant";
import { insertLoan, startTestServer } from "@/test-helpers";

const loanTerms = {
    principal: "120000000",
    annualRatePercent: "18",
    termMonths: 6,
    disbursementDate: "2025-01-15",
};

const terms = {
    principal: 1_000n,
    annualRatePercent: "18",
    termMonths: 1,
    disbursementDate: "2025-01-15",
};

const invoiceTerms = { faceValue: "100000000", tenorDays: 60, fundingDate: "2024-12-31" };

describe("list endpoints", () => {
    let db: Db;
    let api: Awaited<ReturnType<typeof startTestServer>>;
    let keyCount = 0;

    const key = () => ({
        "Idempotency-Key": `list-key-${String(++keyCount).padStart(4, "0")}`,
    });

    const openLoan = async (terms = loanTerms) => {
        const { quoteId } = await (await api.post("/api/loans/quote", terms)).json();
        return (await (await api.post("/api/loans", { quoteId }, key())).json()).loan
            .id as string;
    };

    const pay = async (loanId: string, amount: string, paymentDate: string) => {
        const { stateVersion } = await (
            await api.post(`/api/loans/${loanId}/payments/preview`, {
                amount,
                paymentDate,
            })
        ).json();
        await api.post(
            `/api/loans/${loanId}/payments`,
            { amount, paymentDate, stateVersion },
            key()
        );
    };

    const fundInvoice = async (terms = invoiceTerms) => {
        const { quoteId } = await (await api.post("/api/invoices/quote", terms)).json();
        return (await (await api.post("/api/invoices", { quoteId }, key())).json())
            .invoice.id as string;
    };

    beforeEach(async () => {
        keyCount = 0;
        db = openDatabase();
        api = await startTestServer(db);
    });

    afterEach(async () => {
        await api.close();
    });

    describe("GET /api/loans", () => {
        it("returns an empty list when there are no loans", async () => {
            const res = await api.get("/api/loans");
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual([]);
        });

        it("lists loans newest first with the terms and outstanding principal as strings", async () => {
            await openLoan();
            await openLoan({ ...loanTerms, principal: "50000000", termMonths: 3 });
            const body = await (await api.get("/api/loans")).json();

            expect(body.map((loan: { id: string }) => loan.id)).toEqual(["2", "1"]);
            expect(body[1]).toEqual({
                id: "1",
                principal: "120000000",
                annualRatePercent: "18",
                termMonths: 6,
                disbursementDate: "2025-01-15",
                outstandingPrincipal: "120000000",
            });
            expect(body[0]).toMatchObject({
                principal: "50000000",
                outstandingPrincipal: "50000000",
            });
        });

        it("shows outstanding principal from the instalments, falling as principal is paid", async () => {
            await openLoan();
            await pay("1", "30000000", "2025-02-15");

            const [loan] = await (await api.get("/api/loans")).json();
            expect(loan.outstandingPrincipal).toBe("100736974");
        });

        it("shows zero outstanding once the loan is fully repaid", async () => {
            await openLoan();
            await pay("1", "126378154", "2025-07-15");

            const [loan] = await (await api.get("/api/loans")).json();
            expect(loan.outstandingPrincipal).toBe("0");
        });

        it("does not let interest or surplus change the outstanding principal", async () => {
            await openLoan();
            await pay("1", "500000", "2025-02-15");
            await pay("1", "1000000", "2025-01-20");

            const [loan] = await (await api.get("/api/loans")).json();
            expect(loan.outstandingPrincipal).toBe("120000000");
        });

        it("returns only the newest records once there are more than the list allows", async () => {
            for (let i = 0; i <= LIST_LIMIT; i++)
                insertLoan(db, { ...terms, principal: BigInt(i + 1) });

            const body = await (await api.get("/api/loans")).json();
            expect(body).toHaveLength(LIST_LIMIT);
            expect(body[0].id).toBe(String(LIST_LIMIT + 1));
            expect(body.at(-1).id).toBe("2");
        });

        it("still serves one loan by id", async () => {
            await openLoan();
            expect((await api.get("/api/loans/1")).status).toBe(200);
        });
    });

    describe("GET /api/invoices", () => {
        it("returns an empty list when there are no invoices", async () => {
            expect(await (await api.get("/api/invoices")).json()).toEqual([]);
        });

        it("lists invoices newest first, open until they are settled", async () => {
            await fundInvoice();
            await fundInvoice({ ...invoiceTerms, faceValue: "50000000", tenorDays: 30 });
            const before = await (await api.get("/api/invoices")).json();

            expect(before.map((invoice: { id: string }) => invoice.id)).toEqual([
                "2",
                "1",
            ]);
            expect(
                before.map((invoice: { settled: boolean }) => invoice.settled)
            ).toEqual([false, false]);
            expect(before[1]).toEqual({
                id: "1",
                faceValue: "100000000",
                tenorDays: 60,
                fundingDate: "2024-12-31",
                dueDate: "2025-03-01",
                advance: "80000000",
                reserve: "20000000",
                fee: "4734247",
                settled: false,
            });
        });

        it("marks an invoice settled once it is, and only that one", async () => {
            await fundInvoice();
            await fundInvoice();
            await api.post(
                "/api/invoices/1/settlement",
                { settlementDate: "2025-03-01" },
                key()
            );

            const body = await (await api.get("/api/invoices")).json();
            const settled = Object.fromEntries(
                body.map((invoice: { id: string; settled: boolean }) => [
                    invoice.id,
                    invoice.settled,
                ])
            );
            expect(settled).toEqual({ "1": true, "2": false });
        });

        it("still serves one invoice by id", async () => {
            await fundInvoice();
            expect((await api.get("/api/invoices/1")).status).toBe(200);
        });
    });
});
