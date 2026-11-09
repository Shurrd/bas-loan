import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createApp } from "@/app";
import type { LoanTerms } from "@lending/shared";
import type { Db } from "@/db";
import { createInvoice } from "@/services/invoice";
import { saveInvoiceQuote } from "@/services/invoice-quote";
import { createLoan } from "@/services/loan";
import { saveQuote } from "@/services/quote";

export const startTestServer = async (db: Db) => {
    const server = createApp(db).listen(0);
    await once(server, "listening");
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const send = (
        method: string,
        path: string,
        body?: unknown,
        headers: Record<string, string> = {}
    ) =>
        fetch(url + path, {
            method,
            headers: { "Content-Type": "application/json", ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
        });

    return {
        get: (path: string) => send("GET", path),
        post: (path: string, body?: unknown, headers?: Record<string, string>) =>
            send("POST", path, body, headers),
        postRaw: (path: string, text: string) =>
            fetch(url + path, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: text,
            }),
        close: () => new Promise((resolve) => server.close(resolve)),
    };
};

// A loan row with no instalments or journal entries, for tests that post their own
export const insertLoan = (db: Db, terms: LoanTerms) =>
    createLoan(db, saveQuote(db, terms).quoteId);

export const insertInvoice = (
    db: Db,
    input: { faceValue: bigint; tenorDays: number; fundingDate: string }
) => createInvoice(db, saveInvoiceQuote(db, input).quoteId);
