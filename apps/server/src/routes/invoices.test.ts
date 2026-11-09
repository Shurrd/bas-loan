import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Db, openDatabase } from "@/db";
import { startTestServer } from "@/test-helpers";

const terms = { faceValue: "100000000", tenorDays: 60, fundingDate: "2024-12-31" };

const count = (db: Db, table: string, where = "1 = 1") =>
    Number(
        (
            db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get() as {
                n: bigint;
            }
        ).n
    );

const fields = (body: { errors: { field: string }[] }) =>
    body.errors.map((error) => error.field);

describe("invoice API", () => {
    let db: Db;
    let api: Awaited<ReturnType<typeof startTestServer>>;
    let keyCount = 0;

    const key = () => ({
        "Idempotency-Key": `invoice-${String(++keyCount).padStart(4, "0")}`,
    });

    const quote = async (body: object = terms) =>
        (await api.post("/api/invoices/quote", body)).json();

    // Quotes and funds an invoice, returning its id
    const fund = async (body: object = terms) => {
        const { quoteId } = await quote(body);
        const res = await api.post("/api/invoices", { quoteId }, key());
        return (await res.json()).invoice.id as string;
    };

    const preview = async (id: string, settlementDate: string) =>
        (
            await api.post(`/api/invoices/${id}/settlement/preview`, { settlementDate })
        ).json();

    const settle = async (id: string, settlementDate: string, extra: object = {}) => {
        const res = await api.post(
            `/api/invoices/${id}/settlement`,
            { settlementDate, ...extra },
            key()
        );
        return { res, body: await res.json() };
    };

    const lines = (body: {
        entry: { lines: { account: string; side: string; amount: string }[] };
    }) => body.entry.lines.map((line) => [line.account, line.side, line.amount]);

    beforeEach(async () => {
        keyCount = 0;
        db = openDatabase();
        api = await startTestServer(db);
    });

    afterEach(async () => {
        await api.close();
    });

    describe("POST /api/invoices/quote", () => {
        it("returns the brief's advance, reserve, fee and due date as strings", async () => {
            const res = await api.post("/api/invoices/quote", terms);
            const body = await res.json();

            expect(res.status).toBe(201);
            expect(body).toEqual({
                quoteId: "1",
                faceValue: "100000000",
                tenorDays: 60,
                fundingDate: "2024-12-31",
                dueDate: "2025-03-01",
                advance: "80000000",
                reserve: "20000000",
                fee: "4734247",
            });
        });

        it("saves the quote and posts nothing", async () => {
            await quote();
            expect(count(db, "invoice_quotes")).toBe(1);
            expect(count(db, "invoices")).toBe(0);
            expect(count(db, "journal_entries")).toBe(0);
        });

        it("rounds the advance half-up and takes the fee on the rounded advance", async () => {
            const cases = [
                ["1234567", 30, "987654", "246913", "29224"], // 987,653.6 rounds up
                ["1234563", 30, "987650", "246913", "29224"], // 987,650.4 rounds down
                ["312", 1, "250", "62", "0"], // 249.6 rounds up
                ["311", 1, "249", "62", "0"], // 248.8 rounds up
                ["999999999", 45, "799999999", "200000000", "35506849"],
            ] as const;

            for (const [faceValue, tenorDays, advance, reserve, fee] of cases) {
                const body = await quote({ ...terms, faceValue, tenorDays });
                expect([body.advance, body.reserve, body.fee]).toEqual([
                    advance,
                    reserve,
                    fee,
                ]);
            }
        });

        it("rejects a bad face value, tenor and date against their own fields", async () => {
            for (const faceValue of [100000000, "1000000.00", "0", "-5"]) {
                const res = await api.post("/api/invoices/quote", {
                    ...terms,
                    faceValue,
                });
                expect(res.status).toBe(400);
                expect(fields(await res.json())).toEqual(["faceValue"]);
            }
            for (const tenorDays of [0, 366, 60.5, "60"]) {
                const res = await api.post("/api/invoices/quote", {
                    ...terms,
                    tenorDays,
                });
                expect(fields(await res.json())).toEqual(["tenorDays"]);
            }
            const res = await api.post("/api/invoices/quote", {
                ...terms,
                fundingDate: "2025-02-30",
            });
            expect(fields(await res.json())).toEqual(["fundingDate"]);
            expect(count(db, "invoice_quotes")).toBe(0);
        });
    });

    describe("POST /api/invoices", () => {
        it("funds the invoice from the saved quote and posts the advance entry", async () => {
            const { quoteId } = await quote();
            const res = await api.post("/api/invoices", { quoteId }, key());
            const body = await res.json();

            expect(res.status).toBe(201);
            expect(body.invoice).toEqual({
                id: "1",
                faceValue: "100000000",
                tenorDays: 60,
                fundingDate: "2024-12-31",
                dueDate: "2025-03-01",
                advance: "80000000",
                reserve: "20000000",
                fee: "4734247",
            });
            expect(body.settlement).toBeNull();
            expect(body.entries).toHaveLength(1);
            expect(body.entries[0]).toMatchObject({
                kind: "invoice_advance",
                entryDate: "2024-12-31",
                lines: [
                    { account: "INVOICE_RECEIVABLES", side: "debit", amount: "80000000" },
                    { account: "CASH", side: "credit", amount: "80000000" },
                ],
            });
        });

        it("uses the saved terms and ignores any sent with the approval", async () => {
            const { quoteId } = await quote();
            const res = await api.post(
                "/api/invoices",
                { quoteId, faceValue: "1", advance: "999", tenorDays: 1 },
                key()
            );
            const body = await res.json();
            expect(body.invoice).toMatchObject({
                faceValue: "100000000",
                advance: "80000000",
                tenorDays: 60,
            });
        });

        it("rejects a missing, malformed or unknown quote id", async () => {
            for (const body of [{}, { quoteId: 1 }, { quoteId: "abc" }]) {
                const res = await api.post("/api/invoices", body, key());
                expect(res.status).toBe(400);
                expect(fields(await res.json())).toEqual(["quoteId"]);
            }
            expect(
                (await api.post("/api/invoices", { quoteId: "99" }, key())).status
            ).toBe(404);
            expect(count(db, "invoices")).toBe(0);
        });

        it("needs an Idempotency-Key and creates nothing without one", async () => {
            const { quoteId } = await quote();
            const res = await api.post("/api/invoices", { quoteId });
            expect(fields(await res.json())).toEqual(["Idempotency-Key"]);
            expect(count(db, "invoices")).toBe(0);
        });

        it("replays the original response for the same key, posting once", async () => {
            const { quoteId } = await quote();
            const headers = key();
            const first = await api.post("/api/invoices", { quoteId }, headers);
            const second = await api.post("/api/invoices", { quoteId }, headers);

            expect(second.status).toBe(201);
            expect(second.headers.get("Idempotent-Replayed")).toBe("true");
            expect(await second.json()).toEqual(await first.json());
            expect(count(db, "invoices")).toBe(1);
            expect(count(db, "journal_entries")).toBe(1);
        });

        it("returns 409 for the same key with a different quote and posts nothing more", async () => {
            const first = await quote();
            const second = await quote();
            const headers = key();
            await api.post("/api/invoices", { quoteId: first.quoteId }, headers);

            const res = await api.post(
                "/api/invoices",
                { quoteId: second.quoteId },
                headers
            );
            expect(res.status).toBe(409);
            expect(count(db, "invoices")).toBe(1);
        });

        it("posts once when two requests with the same key arrive together", async () => {
            const { quoteId } = await quote();
            const headers = key();
            const responses = await Promise.all([
                api.post("/api/invoices", { quoteId }, headers),
                api.post("/api/invoices", { quoteId }, headers),
            ]);
            expect(responses.map((res) => res.status)).toEqual([201, 201]);
            expect(count(db, "invoices")).toBe(1);
            expect(count(db, "journal_entries")).toBe(1);
        });

        it("returns 409 with the existing invoice id when the quote is funded again with a new key", async () => {
            const { quoteId } = await quote();
            const first = await (
                await api.post("/api/invoices", { quoteId }, key())
            ).json();

            const res = await api.post("/api/invoices", { quoteId }, key());
            const body = await res.json();

            expect(res.status).toBe(409);
            expect(body.invoiceId).toBe(first.invoice.id);
            expect(count(db, "invoices")).toBe(1);
            expect(count(db, "journal_entries")).toBe(1);
        });

        it("lets two separate quotes with identical terms fund two invoices", async () => {
            const a = await quote();
            const b = await quote();
            const first = await api.post("/api/invoices", { quoteId: a.quoteId }, key());
            const second = await api.post("/api/invoices", { quoteId: b.quoteId }, key());
            expect([first.status, second.status]).toEqual([201, 201]);
            expect(count(db, "invoices")).toBe(2);
        });

        it("rolls back the invoice and the key when posting fails", async () => {
            const log = vi.spyOn(console, "error").mockImplementation(() => {});
            const { quoteId } = await quote();
            db.prepare("DELETE FROM accounts WHERE code = 'CASH'").run();

            const res = await api.post("/api/invoices", { quoteId }, key());

            expect(res.status).toBe(500);
            for (const table of ["invoices", "journal_entries", "idempotency_keys"]) {
                expect(count(db, table)).toBe(0);
            }
            log.mockRestore();
        });
    });

    describe("settlement preview", () => {
        it("works out the brief's 96-days-overdue shortfall on the server and posts nothing", async () => {
            const id = await fund();
            const { settlement } = await preview(id, "2025-06-05");

            expect(settlement).toEqual({
                faceValue: "100000000",
                dueDate: "2025-03-01",
                settlementDate: "2025-06-05",
                advance: "80000000",
                reserve: "20000000",
                fee: "4734247",
                overdueDays: 96,
                penalty: "15360000",
                payableToClient: "0",
                shortfall: "94247",
            });
            expect(count(db, "journal_entries", "kind = 'invoice_settlement'")).toBe(0);
        });

        it("rejects a settlement date before funding against the date field", async () => {
            const id = await fund();
            const res = await api.post(`/api/invoices/${id}/settlement/preview`, {
                settlementDate: "2024-12-30",
            });
            const body = await res.json();
            expect(res.status).toBe(400);
            expect(body.errors).toEqual([
                {
                    field: "settlementDate",
                    message: expect.stringContaining("2024-12-31"),
                },
            ]);
        });

        it("rejects an invalid or far-off date and a missing date", async () => {
            const id = await fund();
            for (const settlementDate of ["2025-02-30", "2101-01-01", "", undefined]) {
                const res = await api.post(`/api/invoices/${id}/settlement/preview`, {
                    settlementDate,
                });
                expect(fields(await res.json())).toEqual(["settlementDate"]);
            }
        });

        it("returns 404 for an unknown invoice", async () => {
            const res = await api.post("/api/invoices/99/settlement/preview", {
                settlementDate: "2025-03-01",
            });
            expect(res.status).toBe(404);
        });
    });

    describe("settlement", () => {
        it("posts the brief's 96-days-overdue shortfall journal exactly", async () => {
            const id = await fund();
            const { res, body } = await settle(id, "2025-06-05");

            expect(res.status).toBe(201);
            expect(body.settlement).toMatchObject({
                overdueDays: 96,
                penalty: "15360000",
                payableToClient: "0",
                shortfall: "94247",
            });
            expect(body.entry).toMatchObject({
                kind: "invoice_settlement",
                entryDate: "2025-06-05",
            });
            expect(lines(body)).toEqual([
                ["CASH", "debit", "100000000"],
                ["CLIENT_RECEIVABLE", "debit", "94247"],
                ["INVOICE_RECEIVABLES", "credit", "80000000"],
                ["FEE_INCOME", "credit", "4734247"],
                ["PENALTY_INCOME", "credit", "15360000"],
            ]);
        });

        it("has no overdue days and no penalty when settled on the due date", async () => {
            const id = await fund();
            const { body } = await settle(id, "2025-03-01");

            expect(body.settlement).toMatchObject({
                overdueDays: 0,
                penalty: "0",
                shortfall: "0",
            });
            expect(body.settlement.payableToClient).toBe("15265753");
            expect(lines(body)).toEqual([
                ["CASH", "debit", "100000000"],
                ["INVOICE_RECEIVABLES", "credit", "80000000"],
                ["FEE_INCOME", "credit", "4734247"],
                ["CLIENT_PAYABLE", "credit", "15265753"],
            ]);
        });

        it("counts the day after the due date as the first overdue day", async () => {
            const id = await fund();
            const { body } = await settle(id, "2025-03-02");

            expect(body.settlement).toMatchObject({ overdueDays: 1, penalty: "160000" });
            expect(body.settlement.payableToClient).toBe("15105753");
            expect(lines(body)).toContainEqual(["PENALTY_INCOME", "credit", "160000"]);
            expect(lines(body)).toContainEqual(["CLIENT_PAYABLE", "credit", "15105753"]);
        });

        it("charges the full tenor fee when the debtor pays early", async () => {
            const id = await fund();
            const { body } = await settle(id, "2025-02-01");

            expect(body.settlement).toMatchObject({
                overdueDays: 0,
                fee: "4734247",
                penalty: "0",
            });
            expect(body.settlement.payableToClient).toBe("15265753");
        });

        it("posts neither Client Payable nor Client Receivable when charges equal the reserve", async () => {
            const id = await fund({
                faceValue: "100000000",
                tenorDays: 73,
                fundingDate: "2025-01-01",
            });
            const { body } = await settle(id, "2025-06-12");

            expect(body.settlement).toMatchObject({
                overdueDays: 89,
                fee: "5760000",
                penalty: "14240000",
                payableToClient: "0",
                shortfall: "0",
            });
            expect(lines(body)).toEqual([
                ["CASH", "debit", "100000000"],
                ["INVOICE_RECEIVABLES", "credit", "80000000"],
                ["FEE_INCOME", "credit", "5760000"],
                ["PENALTY_INCOME", "credit", "14240000"],
            ]);
        });

        it("keeps payable at zero and reports the shortfall separately", async () => {
            const id = await fund();
            const { body } = await settle(id, "2025-06-05");
            expect(body.settlement.payableToClient).toBe("0");
            expect(body.settlement.shortfall).toBe("94247");
            expect(BigInt(body.settlement.payableToClient) >= 0n).toBe(true);
        });

        it("rounds the penalty half-up on the rounded advance", async () => {
            // advance 249.6 becomes 250, and 250 x 0.2% for one day is exactly 0.5, which rounds up to 1
            const cases = [
                ["312", "1", "61"], // advance 250: penalty 0.5 -> 1
                ["311", "0", "62"], // advance 249: penalty 0.498 -> 0
                ["315", "1", "62"], // advance 252: penalty 0.504 -> 1
            ] as const;

            for (const [faceValue, penalty, payable] of cases) {
                const id = await fund({
                    faceValue,
                    tenorDays: 1,
                    fundingDate: "2025-01-01",
                });
                const { body } = await settle(id, "2025-01-03");
                expect(body.settlement.overdueDays).toBe(1);
                expect(body.settlement.penalty).toBe(penalty);
                expect(body.settlement.payableToClient).toBe(payable);
            }
        });

        it("rounds the penalty once over all the overdue days, not per day", async () => {
            // advance 987,654: one day is 1,975.308, ten days is 19,753.08
            const id = await fund({
                faceValue: "1234567",
                tenorDays: 30,
                fundingDate: "2025-01-01",
            });
            const { body } = await settle(id, "2025-02-10");
            expect(body.settlement).toMatchObject({
                overdueDays: 10,
                penalty: "19753",
                fee: "29224",
            });
        });

        it("always takes the face value from the debtor and ignores any amount sent", async () => {
            const id = await fund();
            const { body } = await settle(id, "2025-03-01", {
                amount: "1",
                payableToClient: "999999",
            });
            expect(lines(body)[0]).toEqual(["CASH", "debit", "100000000"]);
            expect(body.settlement.payableToClient).toBe("15265753");
        });

        it("posts the same figures that the preview showed", async () => {
            const id = await fund();
            const previewed = await preview(id, "2025-06-05");
            const { body } = await settle(id, "2025-06-05");
            expect(body.settlement).toEqual(previewed.settlement);
        });

        it("keeps the journal balanced", async () => {
            const id = await fund();
            await settle(id, "2025-06-05");
            const sums = db
                .prepare(
                    `SELECT SUM(CASE WHEN side = 'debit' THEN amount END) AS debit,
                            SUM(CASE WHEN side = 'credit' THEN amount END) AS credit
                     FROM journal_lines`
                )
                .get() as { debit: bigint; credit: bigint };
            expect(sums.debit).toBe(sums.credit);
        });

        it("replays the original response for the same key, posting once", async () => {
            const id = await fund();
            const headers = key();
            const body = { settlementDate: "2025-06-05" };
            const first = await api.post(`/api/invoices/${id}/settlement`, body, headers);
            const second = await api.post(
                `/api/invoices/${id}/settlement`,
                body,
                headers
            );

            expect(second.status).toBe(201);
            expect(second.headers.get("Idempotent-Replayed")).toBe("true");
            expect(await second.json()).toEqual(await first.json());
            expect(count(db, "journal_entries", "kind = 'invoice_settlement'")).toBe(1);
        });

        it("returns 409 for the same key with a different date", async () => {
            const id = await fund();
            const headers = key();
            await api.post(
                `/api/invoices/${id}/settlement`,
                { settlementDate: "2025-06-05" },
                headers
            );
            const res = await api.post(
                `/api/invoices/${id}/settlement`,
                { settlementDate: "2025-06-06" },
                headers
            );
            expect(res.status).toBe(409);
            expect(count(db, "journal_entries", "kind = 'invoice_settlement'")).toBe(1);
        });

        it("settles only once, whatever the key or the date", async () => {
            const id = await fund();
            await settle(id, "2025-03-01");

            for (const date of ["2025-03-01", "2025-06-05"]) {
                const { res, body } = await settle(id, date);
                expect(res.status).toBe(409);
                expect(body).toMatchObject({ code: "ALREADY_SETTLED", invoiceId: id });
            }
            expect(count(db, "journal_entries", "kind = 'invoice_settlement'")).toBe(1);
        });

        it("rolls back the entry and the key when posting fails", async () => {
            const log = vi.spyOn(console, "error").mockImplementation(() => {});
            const id = await fund();
            db.prepare("DELETE FROM accounts WHERE code = 'FEE_INCOME'").run();

            const { res } = await settle(id, "2025-06-05");

            expect(res.status).toBe(500);
            expect(count(db, "journal_entries", "kind = 'invoice_settlement'")).toBe(0);
            expect(count(db, "idempotency_keys")).toBe(1);
            log.mockRestore();
        });

        it("rejects a date before funding or an invalid one, posting nothing", async () => {
            const id = await fund();
            for (const settlementDate of ["2024-12-30", "2025-02-30", undefined]) {
                const { res, body } = await settle(id, settlementDate as string);
                expect(res.status).toBe(400);
                expect(fields(body)).toEqual(["settlementDate"]);
            }
            expect(count(db, "journal_entries", "kind = 'invoice_settlement'")).toBe(0);
        });

        it("needs an Idempotency-Key and returns 404 for an unknown invoice", async () => {
            const id = await fund();
            const noKey = await api.post(`/api/invoices/${id}/settlement`, {
                settlementDate: "2025-03-01",
            });
            expect(fields(await noKey.json())).toEqual(["Idempotency-Key"]);

            const unknown = await api.post(
                "/api/invoices/99/settlement",
                { settlementDate: "2025-03-01" },
                key()
            );
            expect(unknown.status).toBe(404);
        });
    });

    describe("GET /api/invoices/:id", () => {
        it("shows the settlement and both journal entries once settled", async () => {
            const id = await fund();
            await settle(id, "2025-06-05");
            const body = await (await api.get(`/api/invoices/${id}`)).json();

            expect(body.settlement).toMatchObject({
                settlementDate: "2025-06-05",
                shortfall: "94247",
            });
            expect(body.entries.map((entry: { kind: string }) => entry.kind)).toEqual([
                "invoice_advance",
                "invoice_settlement",
            ]);
        });

        it("returns 404 for an unknown or malformed id", async () => {
            expect((await api.get("/api/invoices/99")).status).toBe(404);
            expect((await api.get("/api/invoices/abc")).status).toBe(404);
        });
    });
});
