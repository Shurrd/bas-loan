import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Db, openDatabase } from "@/db";
import { startTestServer } from "@/test-helpers";

const terms = {
    principal: "120000000",
    annualRatePercent: "18",
    termMonths: 6,
    disbursementDate: "2025-01-15",
};

const key = (value: string) => ({ "Idempotency-Key": value });

const count = (db: Db, table: string) =>
    Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: bigint }).n);

const fields = (body: { errors: { field: string }[] }) =>
    body.errors.map((error) => error.field);

describe("loan API", () => {
    let db: Db;
    let api: Awaited<ReturnType<typeof startTestServer>>;

    const quote = async (body = terms) =>
        (await api.post("/api/loans/quote", body)).json();

    beforeEach(async () => {
        db = openDatabase();
        api = await startTestServer(db);
    });

    afterEach(async () => {
        await api.close();
    });

    describe("POST /api/loans/quote", () => {
        it("returns Worked Example 1 with a quote id and every amount as a string", async () => {
            const res = await api.post("/api/loans/quote", terms);
            const body = await res.json();

            expect(res.status).toBe(201);
            expect(body.quoteId).toBe("1");
            expect(body.totalInterest).toBe("6378154");
            expect(body.schedule).toHaveLength(6);
            expect(body.schedule[0]).toEqual({
                number: 1,
                dueDate: "2025-02-15",
                payment: "21063026",
                interest: "1800000",
                principal: "19263026",
                closingBalance: "100736974",
            });
            expect(body.schedule[5].payment).toBe("21063024");
            for (const row of body.schedule) {
                for (const field of [
                    "payment",
                    "interest",
                    "principal",
                    "closingBalance",
                ]) {
                    expect(typeof row[field]).toBe("string");
                }
            }
        });

        it("saves the terms and schedule and posts nothing", async () => {
            await quote();
            expect(count(db, "quotes")).toBe(1);
            expect(count(db, "quote_instalments")).toBe(6);
            expect(count(db, "loans")).toBe(0);
            expect(count(db, "journal_entries")).toBe(0);
            expect(count(db, "journal_lines")).toBe(0);
        });

        it("rejects principal sent as a number or with a decimal point", async () => {
            for (const principal of [120000000, "1200000.00", "-5", "1e8"]) {
                const res = await api.post("/api/loans/quote", { ...terms, principal });
                expect(res.status).toBe(400);
                expect(fields(await res.json())).toEqual(["principal"]);
            }
            expect(count(db, "quotes")).toBe(0);
        });

        it("reports each bad field against its own name", async () => {
            const res = await api.post("/api/loans/quote", {
                principal: "100",
                annualRatePercent: "abc",
                termMonths: 0,
                disbursementDate: "2025-02-30",
            });
            const body = await res.json();
            expect(res.status).toBe(400);
            expect(fields(body)).toEqual([
                "annualRatePercent",
                "termMonths",
                "disbursementDate",
            ]);
            expect(body.errors[0].message).toEqual(expect.any(String));
        });

        it("rejects a body that is not JSON", async () => {
            const res = await api.postRaw("/api/loans/quote", "{not json");
            expect(res.status).toBe(400);
            expect((await res.json()).message).toMatch(/not valid JSON/);
        });
    });

    describe("POST /api/loans", () => {
        it("disburses the loan from the saved quote and posts the disbursement entry", async () => {
            const { quoteId, schedule } = await quote();
            const res = await api.post("/api/loans", { quoteId }, key("approve-0001"));
            const body = await res.json();

            expect(res.status).toBe(201);
            expect(body.loan).toEqual({ id: "1", ...terms });
            expect(body.schedule.map((row: { payment: string }) => row.payment)).toEqual(
                schedule.map((row: { payment: string }) => row.payment)
            );
            expect(body.schedule[5].closingBalance).toBe("0");
            expect(body.entries).toHaveLength(1);
            expect(body.entries[0]).toMatchObject({
                kind: "disbursement",
                entryDate: "2025-01-15",
                reversesEntryId: null,
                lines: [
                    { account: "LOANS_RECEIVABLE", side: "debit", amount: "120000000" },
                    { account: "CASH", side: "credit", amount: "120000000" },
                ],
            });
        });

        it("uses the saved terms and ignores any terms sent with the approval", async () => {
            const { quoteId } = await quote();
            const res = await api.post(
                "/api/loans",
                { quoteId, principal: "999", annualRatePercent: "99", termMonths: 1 },
                key("approve-0001")
            );
            const body = await res.json();
            expect(body.loan).toMatchObject({
                principal: "120000000",
                annualRatePercent: "18",
                termMonths: 6,
            });
            expect(body.entries[0].lines[0].amount).toBe("120000000");
        });

        it("returns the same detail from GET /api/loans/:id", async () => {
            const { quoteId } = await quote();
            const created = await (
                await api.post("/api/loans", { quoteId }, key("approve-0001"))
            ).json();
            expect(await (await api.get("/api/loans/1")).json()).toEqual(created);
        });

        it("rejects a missing, malformed or unknown quote id", async () => {
            for (const body of [
                {},
                { quoteId: 1 },
                { quoteId: "abc" },
                { quoteId: "-1" },
            ]) {
                const res = await api.post("/api/loans", body, key("approve-0001"));
                expect(res.status).toBe(400);
                expect(fields(await res.json())).toEqual(["quoteId"]);
            }
            const unknown = await api.post(
                "/api/loans",
                { quoteId: "99" },
                key("approve-0001")
            );
            expect(unknown.status).toBe(404);
            expect(count(db, "loans")).toBe(0);
            expect(count(db, "idempotency_keys")).toBe(0);
        });

        it("requires a well-formed Idempotency-Key and creates nothing without one", async () => {
            const { quoteId } = await quote();
            for (const headers of [undefined, key("short"), key("has spaces in it")]) {
                const res = await api.post("/api/loans", { quoteId }, headers);
                expect(res.status).toBe(400);
                expect(fields(await res.json())).toEqual(["Idempotency-Key"]);
            }
            expect(count(db, "loans")).toBe(0);
        });

        it("replays the original response for the same key and body, posting once", async () => {
            const { quoteId } = await quote();
            const first = await api.post("/api/loans", { quoteId }, key("approve-0001"));
            const second = await api.post("/api/loans", { quoteId }, key("approve-0001"));

            expect(second.status).toBe(first.status);
            expect(second.headers.get("Idempotent-Replayed")).toBe("true");
            expect(first.headers.get("Idempotent-Replayed")).toBeNull();
            expect(await second.json()).toEqual(await first.json());
            expect(count(db, "loans")).toBe(1);
            expect(count(db, "loan_instalments")).toBe(6);
            expect(count(db, "journal_entries")).toBe(1);
            expect(count(db, "journal_lines")).toBe(2);
        });

        it("returns 409 for the same key with a different body and posts nothing", async () => {
            const first = await quote();
            const second = await quote();
            await api.post("/api/loans", { quoteId: first.quoteId }, key("approve-0001"));

            const res = await api.post(
                "/api/loans",
                { quoteId: second.quoteId },
                key("approve-0001")
            );
            expect(res.status).toBe(409);
            expect(count(db, "loans")).toBe(1);
            expect(count(db, "journal_entries")).toBe(1);
        });

        it("posts once when two requests with the same key arrive together", async () => {
            const { quoteId } = await quote();
            const responses = await Promise.all([
                api.post("/api/loans", { quoteId }, key("approve-0001")),
                api.post("/api/loans", { quoteId }, key("approve-0001")),
            ]);
            expect(responses.map((res) => res.status)).toEqual([201, 201]);
            expect(count(db, "loans")).toBe(1);
            expect(count(db, "journal_entries")).toBe(1);
        });

        it("returns 409 with the existing loan id when the same quote is approved with a new key", async () => {
            const { quoteId } = await quote();
            const first = await (
                await api.post("/api/loans", { quoteId }, key("approve-0001"))
            ).json();

            const res = await api.post("/api/loans", { quoteId }, key("approve-0002"));
            const body = await res.json();

            expect(res.status).toBe(409);
            expect(body.loanId).toBe(first.loan.id);
            expect(body.message).toMatch(/already been approved/);
            expect(count(db, "loans")).toBe(1);
            expect(count(db, "loan_instalments")).toBe(6);
            expect(count(db, "journal_entries")).toBe(1);
            expect(count(db, "idempotency_keys")).toBe(1);
        });

        it("still replays the first approval after a second key was refused", async () => {
            const { quoteId } = await quote();
            const first = await api.post("/api/loans", { quoteId }, key("approve-0001"));
            await api.post("/api/loans", { quoteId }, key("approve-0002"));

            const again = await api.post("/api/loans", { quoteId }, key("approve-0001"));
            expect(again.status).toBe(201);
            expect(await again.json()).toEqual(await first.json());
        });

        it("lets two separate quotes with identical terms create two loans", async () => {
            const first = await quote();
            const second = await quote();
            expect(second.quoteId).not.toBe(first.quoteId);

            const a = await api.post(
                "/api/loans",
                { quoteId: first.quoteId },
                key("approve-0001")
            );
            const b = await api.post(
                "/api/loans",
                { quoteId: second.quoteId },
                key("approve-0002")
            );

            expect([a.status, b.status]).toEqual([201, 201]);
            expect(count(db, "loans")).toBe(2);
            expect(count(db, "journal_entries")).toBe(2);
        });

        it("does not consume the key when the quote is unknown", async () => {
            const bad = await api.post(
                "/api/loans",
                { quoteId: "99" },
                key("approve-0001")
            );
            expect(bad.status).toBe(404);

            const { quoteId } = await quote();
            const good = await api.post("/api/loans", { quoteId }, key("approve-0001"));
            expect(good.status).toBe(201);
        });

        it("rolls back the loan, instalments and key when posting fails", async () => {
            const log = vi.spyOn(console, "error").mockImplementation(() => {});
            const { quoteId } = await quote();
            db.prepare("DELETE FROM accounts WHERE code = 'CASH'").run();

            const res = await api.post("/api/loans", { quoteId }, key("approve-0001"));

            expect(res.status).toBe(500);
            for (const table of [
                "loans",
                "loan_instalments",
                "journal_entries",
                "idempotency_keys",
            ]) {
                expect(count(db, table)).toBe(0);
            }
            log.mockRestore();
        });

        it("stores instalments whose principal adds up to the loan", async () => {
            const { quoteId } = await quote();
            await api.post("/api/loans", { quoteId }, key("approve-0001"));
            const row = db
                .prepare("SELECT SUM(principal) AS total FROM loan_instalments")
                .get() as {
                total: bigint;
            };
            expect(row.total).toBe(120_000_000n);
        });
    });

    describe("GET /api/loans/:id", () => {
        it("returns 404 for an unknown or malformed id", async () => {
            expect((await api.get("/api/loans/99")).status).toBe(404);
            expect((await api.get("/api/loans/abc")).status).toBe(404);
        });
    });
});
