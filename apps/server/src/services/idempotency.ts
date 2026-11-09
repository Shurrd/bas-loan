import { createHash } from "node:crypto";
import type { Request } from "express";
import type { Db } from "@/db";
import { ConflictError, ValidationError } from "@/lib/errors";
import { toWire } from "@/lib/wire";

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

type SavedRow = { request_hash: string; status: bigint; response: string };

type IdempotentResult = { status: number; body: string; replayed: boolean };

const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .sort(([a], [b]) => (a < b ? -1 : 1))
                .map(([key, item]) => [key, sortKeys(item)])
        );
    }
    return value;
};

export const hashRequest = (method: string, path: string, body: unknown) =>
    createHash("sha256")
        .update(JSON.stringify([method, path, sortKeys(body)]))
        .digest("hex");

// The key lookup, the posting and the key insert share one transaction, so a failed
// posting leaves no key behind and a replay can never post twice.
export const runIdempotent = (
    db: Db,
    key: string,
    requestHash: string,
    run: () => { status: number; body: unknown }
) =>
    db
        .transaction((): IdempotentResult => {
            const saved = db
                .prepare(
                    "SELECT request_hash, status, response FROM idempotency_keys WHERE key = ?"
                )
                .get(key) as SavedRow | undefined;

            if (saved) {
                if (saved.request_hash !== requestHash) {
                    throw new ConflictError(
                        "This idempotency key was already used for a different request"
                    );
                }
                return {
                    status: Number(saved.status),
                    body: saved.response,
                    replayed: true,
                };
            }

            const result = run();
            const body = JSON.stringify(toWire(result.body));
            db.prepare(
                "INSERT INTO idempotency_keys (key, request_hash, status, response) VALUES (?, ?, ?, ?)"
            ).run(key, requestHash, result.status, body);
            return { status: result.status, body, replayed: false };
        })
        .immediate();

export const readIdempotencyKey = (req: Request) => {
    const key = req.header("Idempotency-Key") ?? "";
    if (!KEY_PATTERN.test(key)) {
        throw new ValidationError([
            {
                field: "Idempotency-Key",
                message:
                    "Send an Idempotency-Key header of 8 to 128 letters, digits, - or _",
            },
        ]);
    }
    return key;
};
