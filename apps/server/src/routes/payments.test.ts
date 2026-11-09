import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Db, openDatabase } from "@/db";
import { startTestServer } from "@/test-helpers";

const terms = {
    principal: "120000000",
    annualRatePercent: "18",
    termMonths: 6,
    disbursementDate: "2025-01-15",
};

const count = (db: Db, table: string, where = "1 = 1") =>
    Number(
        (
            db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get() as {
                n: bigint;
            }
        ).n
    );

describe("repayment API", () => {
    let db: Db;
    let api: Awaited<ReturnType<typeof startTestServer>>;
    let keyCount = 0;

    const nextKey = () => ({
        "Idempotency-Key": `payment-${String(++keyCount).padStart(4, "0")}`,
    });

    const preview = async (amount: string, paymentDate: string) =>
        (await api.post("/api/loans/1/payments/preview", { amount, paymentDate })).json();

    // Previews and confirms the way the officer does, returning the confirm response
    const pay = async (amount: string, paymentDate: string) => {
        const { stateVersion } = await preview(amount, paymentDate);
        const res = await api.post(
            "/api/loans/1/payments",
            { amount, paymentDate, stateVersion },
            nextKey()
        );
        return { res, body: await res.json() };
    };

    const instalments = async () =>
        (await (await api.get("/api/loans/1")).json()).schedule;

    const lines = (body: {
        entry: { lines: { account: string; side: string; amount: string }[] };
    }) => body.entry.lines.map((line) => [line.account, line.side, line.amount]);

    beforeEach(async () => {
        keyCount = 0;
        db = openDatabase();
        api = await startTestServer(db);
        const { quoteId } = await (await api.post("/api/loans/quote", terms)).json();
        await api.post("/api/loans", { quoteId }, { "Idempotency-Key": "approve-0001" });
    });

    afterEach(async () => {
        await api.close();
    });

    describe("POST /api/loans/:id/payments/preview", () => {
        it("returns the server allocation and a state version, and posts nothing", async () => {
            const body = await preview("2000000", "2025-02-15");

            expect(body.stateVersion).toBe("1");
            expect(body.allocation).toEqual({
                received: "2000000",
                lines: [
                    {
                        number: 1,
                        penalty: "0",
                        fee: "0",
                        interest: "1800000",
                        principal: "200000",
                    },
                ],
                penalty: "0",
                fee: "0",
                interest: "1800000",
                principal: "200000",
                unapplied: "0",
            });
            expect(count(db, "journal_entries")).toBe(1);
        });

        it("returns 404 for an unknown loan", async () => {
            const res = await api.post("/api/loans/99/payments/preview", {
                amount: "100",
                paymentDate: "2025-02-15",
            });
            expect(res.status).toBe(404);
        });
    });

    describe("POST /api/loans/:id/payments", () => {
        it("stops inside interest on a small partial payment", async () => {
            const { res, body } = await pay("500000", "2025-02-15");

            expect(res.status).toBe(201);
            expect(body.allocation.interest).toBe("500000");
            expect(body.allocation.principal).toBe("0");
            expect(body.entry).toMatchObject({
                kind: "payment",
                entryDate: "2025-02-15",
            });
            expect(lines(body)).toEqual([
                ["CASH", "debit", "500000"],
                ["INTEREST_INCOME", "credit", "500000"],
            ]);

            const [first] = await instalments();
            expect(first).toMatchObject({ interestPaid: "500000", principalPaid: "0" });
        });

        it("continues from a part-paid instalment on the next payment", async () => {
            await pay("500000", "2025-02-15");
            const { body } = await pay("2000000", "2025-02-15");

            expect(body.allocation.lines).toEqual([
                {
                    number: 1,
                    penalty: "0",
                    fee: "0",
                    interest: "1300000",
                    principal: "700000",
                },
            ]);
            const [first] = await instalments();
            expect(first).toMatchObject({
                interestPaid: "1800000",
                principalPaid: "700000",
            });
        });

        it("stops inside principal once interest is cleared", async () => {
            const { body } = await pay("2000000", "2025-02-15");

            expect(lines(body)).toEqual([
                ["CASH", "debit", "2000000"],
                ["LOANS_RECEIVABLE", "credit", "200000"],
                ["INTEREST_INCOME", "credit", "1800000"],
            ]);
            const [first] = await instalments();
            expect(first).toMatchObject({
                interestPaid: "1800000",
                principalPaid: "200000",
            });
        });

        it("pays several overdue instalments oldest first", async () => {
            const { body } = await pay("50000000", "2025-04-15");

            expect(
                body.allocation.lines.map((line: { number: number }) => line.number)
            ).toEqual([1, 2, 3]);
            const states = await instalments();
            expect(states[0]).toMatchObject({
                interestPaid: "1800000",
                principalPaid: "19263026",
            });
            expect(states[1]).toMatchObject({
                interestPaid: "1511055",
                principalPaid: "19551971",
            });
            expect(states[2]).toMatchObject({
                interestPaid: "1217775",
                principalPaid: "6656173",
            });
            expect(states[3]).toMatchObject({ interestPaid: "0", principalPaid: "0" });
        });

        it("sends the surplus to Unapplied Credit without touching later instalments", async () => {
            const { body } = await pay("30000000", "2025-02-15");

            expect(lines(body)).toEqual([
                ["CASH", "debit", "30000000"],
                ["LOANS_RECEIVABLE", "credit", "19263026"],
                ["INTEREST_INCOME", "credit", "1800000"],
                ["UNAPPLIED_CREDIT", "credit", "8936974"],
            ]);
            const states = await instalments();
            expect(states[1]).toMatchObject({ interestPaid: "0", principalPaid: "0" });
        });

        it("puts the whole payment in Unapplied Credit when nothing is due", async () => {
            const { body } = await pay("1000000", "2025-01-20");

            expect(body.allocation.lines).toEqual([]);
            expect(lines(body)).toEqual([
                ["CASH", "debit", "1000000"],
                ["UNAPPLIED_CREDIT", "credit", "1000000"],
            ]);
            for (const state of await instalments()) {
                expect(state).toMatchObject({ interestPaid: "0", principalPaid: "0" });
            }
        });

        it("clears every instalment and sends an overpayment on the last one to Unapplied Credit", async () => {
            const { body } = await pay("127378154", "2025-07-15");

            expect(body.allocation).toMatchObject({
                principal: "120000000",
                interest: "6378154",
                unapplied: "1000000",
            });
            for (const state of await instalments()) {
                expect(state.interestPaid).toBe(state.interest);
                expect(state.principalPaid).toBe(state.principal);
            }
            expect(lines(body).at(-1)).toEqual(["UNAPPLIED_CREDIT", "credit", "1000000"]);
        });

        it("posts only what the server computes, whatever the client adds to the body", async () => {
            const { stateVersion } = await preview("2000000", "2025-02-15");
            const res = await api.post(
                "/api/loans/1/payments",
                {
                    amount: "2000000",
                    paymentDate: "2025-02-15",
                    stateVersion,
                    allocation: { principal: "2000000", interest: "0", unapplied: "0" },
                    principal: "2000000",
                },
                nextKey()
            );
            const body = await res.json();

            expect(body.allocation).toMatchObject({
                interest: "1800000",
                principal: "200000",
            });
            expect(lines(body)).toContainEqual(["INTEREST_INCOME", "credit", "1800000"]);
        });

        it("posts the same allocation the officer previewed", async () => {
            const previewed = await preview("30000000", "2025-02-15");
            const { body } = await pay("30000000", "2025-02-15");
            expect(body.allocation).toEqual(previewed.allocation);
        });

        it("keeps the journal balanced", async () => {
            await pay("30000000", "2025-02-15");
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
            const { stateVersion } = await preview("2000000", "2025-02-15");
            const body = { amount: "2000000", paymentDate: "2025-02-15", stateVersion };
            const headers = nextKey();

            const first = await api.post("/api/loans/1/payments", body, headers);
            const second = await api.post("/api/loans/1/payments", body, headers);

            expect(second.status).toBe(201);
            expect(second.headers.get("Idempotent-Replayed")).toBe("true");
            expect(await second.json()).toEqual(await first.json());
            expect(count(db, "journal_entries", "kind = 'payment'")).toBe(1);
            const [state] = await instalments();
            expect(state).toMatchObject({
                interestPaid: "1800000",
                principalPaid: "200000",
            });
        });

        it("returns 409 for the same key with a different amount and posts nothing more", async () => {
            const { stateVersion } = await preview("2000000", "2025-02-15");
            const headers = nextKey();
            await api.post(
                "/api/loans/1/payments",
                { amount: "2000000", paymentDate: "2025-02-15", stateVersion },
                headers
            );

            const res = await api.post(
                "/api/loans/1/payments",
                { amount: "3000000", paymentDate: "2025-02-15", stateVersion },
                headers
            );
            expect(res.status).toBe(409);
            expect(count(db, "journal_entries", "kind = 'payment'")).toBe(1);
        });

        it("returns 409 and posts nothing when the loan changed after the preview", async () => {
            const stale = await preview("2000000", "2025-02-15");
            await pay("500000", "2025-02-15");

            const res = await api.post(
                "/api/loans/1/payments",
                {
                    amount: "2000000",
                    paymentDate: "2025-02-15",
                    stateVersion: stale.stateVersion,
                },
                nextKey()
            );
            const body = await res.json();

            expect(res.status).toBe(409);
            expect(body.code).toBe("STATE_CHANGED");
            expect(count(db, "journal_entries", "kind = 'payment'")).toBe(1);
            const [state] = await instalments();
            expect(state).toMatchObject({ interestPaid: "500000", principalPaid: "0" });
        });

        it("cannot post the same preview twice by changing the key", async () => {
            const { stateVersion } = await preview("2000000", "2025-02-15");
            const body = { amount: "2000000", paymentDate: "2025-02-15", stateVersion };
            const first = await api.post("/api/loans/1/payments", body, nextKey());
            const second = await api.post("/api/loans/1/payments", body, nextKey());

            expect(first.status).toBe(201);
            expect(second.status).toBe(409);
            expect(count(db, "journal_entries", "kind = 'payment'")).toBe(1);
        });

        it("rejects zero, negative and non-digit amounts against the amount field", async () => {
            for (const amount of ["0", "-5", "10.50", "", 2000000]) {
                const res = await api.post(
                    "/api/loans/1/payments",
                    { amount, paymentDate: "2025-02-15", stateVersion: "1" },
                    nextKey()
                );
                const body = await res.json();
                expect(res.status).toBe(400);
                expect(body.errors.map((e: { field: string }) => e.field)).toEqual([
                    "amount",
                ]);
            }
            expect(count(db, "journal_entries", "kind = 'payment'")).toBe(0);
        });

        it("rejects a payment date before disbursement against the date field", async () => {
            const res = await api.post(
                "/api/loans/1/payments",
                { amount: "100", paymentDate: "2025-01-14", stateVersion: "1" },
                nextKey()
            );
            const body = await res.json();
            expect(res.status).toBe(400);
            expect(body.errors).toEqual([
                { field: "paymentDate", message: expect.stringContaining("2025-01-15") },
            ]);
        });

        it("needs the state version and an Idempotency-Key", async () => {
            const noVersion = await api.post(
                "/api/loans/1/payments",
                { amount: "100", paymentDate: "2025-02-15" },
                nextKey()
            );
            expect((await noVersion.json()).errors[0].field).toBe("stateVersion");

            const noKey = await api.post("/api/loans/1/payments", {
                amount: "100",
                paymentDate: "2025-02-15",
                stateVersion: "1",
            });
            expect((await noKey.json()).errors[0].field).toBe("Idempotency-Key");
        });

        it("returns every amount as a string", async () => {
            const { body } = await pay("30000000", "2025-02-15");
            const walk = (value: unknown, path: string) => {
                if (typeof value === "number") expect(path).toMatch(/\.number$/);
                if (Array.isArray(value))
                    value.forEach((item, i) => walk(item, `${path}[${i}]`));
                else if (value && typeof value === "object") {
                    for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
                }
            };
            walk(body, "body");
        });

        it("rolls back the entry, the key and the paid amounts when an instalment update fails", async () => {
            const log = vi.spyOn(console, "error").mockImplementation(() => {});
            const { stateVersion } = await preview("2000000", "2025-02-15");
            db.exec(
                "CREATE TRIGGER fail_update BEFORE UPDATE ON loan_instalments BEGIN SELECT RAISE(ABORT, 'boom'); END"
            );

            const res = await api.post(
                "/api/loans/1/payments",
                { amount: "2000000", paymentDate: "2025-02-15", stateVersion },
                nextKey()
            );

            expect(res.status).toBe(500);
            expect(count(db, "journal_entries", "kind = 'payment'")).toBe(0);
            expect(count(db, "idempotency_keys")).toBe(1);
            log.mockRestore();
        });

        it("rolls back the instalment updates when the journal entry fails", async () => {
            const log = vi.spyOn(console, "error").mockImplementation(() => {});
            const { stateVersion } = await preview("2000000", "2025-02-15");
            db.prepare("DELETE FROM accounts WHERE code = 'INTEREST_INCOME'").run();

            const res = await api.post(
                "/api/loans/1/payments",
                { amount: "2000000", paymentDate: "2025-02-15", stateVersion },
                nextKey()
            );

            expect(res.status).toBe(500);
            const [state] = await instalments();
            expect(state).toMatchObject({ interestPaid: "0", principalPaid: "0" });
            expect(count(db, "idempotency_keys")).toBe(1);
            log.mockRestore();
        });
    });
});
