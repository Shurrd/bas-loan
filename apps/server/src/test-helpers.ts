import { once } from "node:events";
import { Agent, request } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "@/app";
import type { LoanTerms } from "@lending/shared";
import type { Db } from "@/db";
import { createInvoice } from "@/services/invoice";
import { saveInvoiceQuote } from "@/services/invoice-quote";
import { createLoan } from "@/services/loan";
import { saveQuote } from "@/services/quote";

// Node's fetch keeps connections open and can reuse one that a closing test server has just dropped,
// which fails now and then with "other side closed". These requests never reuse a connection.
const agent = new Agent({ keepAlive: false });

const call = (
    url: string,
    method: string,
    body?: string,
    headers: Record<string, string> = {}
) =>
    new Promise<Response>((resolve, reject) => {
        const req = request(
            url,
            {
                method,
                agent,
                headers: { "Content-Type": "application/json", ...headers },
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on("data", (chunk: Buffer) => chunks.push(chunk));
                res.on("end", () =>
                    resolve(
                        new Response(Buffer.concat(chunks), {
                            status: res.statusCode,
                            headers: Object.entries(res.headers).flatMap(
                                ([name, value]) =>
                                    value === undefined
                                        ? []
                                        : [
                                              [name, [value].flat().join(", ")] as [
                                                  string,
                                                  string,
                                              ],
                                          ]
                            ),
                        })
                    )
                );
            }
        );
        req.on("error", reject);
        if (body !== undefined) req.write(body);
        req.end();
    });

export const startTestServer = async (db: Db, options?: { clientDir?: string }) => {
    const server = createApp(db, options).listen(0);
    await once(server, "listening");
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const send = (
        method: string,
        path: string,
        body?: unknown,
        headers?: Record<string, string>
    ) =>
        call(
            url + path,
            method,
            body === undefined ? undefined : JSON.stringify(body),
            headers
        );

    return {
        url,
        get: (path: string) => send("GET", path),
        post: (path: string, body?: unknown, headers?: Record<string, string>) =>
            send("POST", path, body, headers),
        postRaw: (path: string, text: string) => call(url + path, "POST", text),
        close: () =>
            new Promise((resolve) => {
                server.close(resolve);
                server.closeAllConnections();
            }),
    };
};

// A loan row with no instalments or journal entries, for tests that post their own
export const insertLoan = (db: Db, terms: LoanTerms) =>
    createLoan(db, saveQuote(db, terms).quoteId);

export const insertInvoice = (
    db: Db,
    input: { faceValue: bigint; tenorDays: number; fundingDate: string }
) => createInvoice(db, saveInvoiceQuote(db, input).quoteId);
