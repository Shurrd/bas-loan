import { Router, type Request } from "express";
import type { Db } from "@/db";
import { NotFoundError } from "@/lib/errors";
import { toWire } from "@/lib/wire";
import { hashRequest, readIdempotencyKey, runIdempotent } from "@/services/idempotency";
import { getLoanRecord } from "@/services/loan";
import { confirmPayment, previewPayment } from "@/services/repayment";
import { parsePaymentRequest } from "@/validators/payment";

const loadLoan = (db: Db, req: Request<{ id: string }>) => {
    if (!/^\d+$/.test(req.params.id)) throw new NotFoundError("Loan not found");
    return getLoanRecord(db, BigInt(req.params.id));
};

export const paymentRoutes = (db: Db) => {
    const router = Router({ mergeParams: true });

    router.post<"/preview", { id: string }>("/preview", (req, res) => {
        const loan = loadLoan(db, req);
        const input = parsePaymentRequest(req.body, loan.disbursementDate, false);
        res.json(toWire(previewPayment(db, loan.id, input)));
    });

    router.post<"/", { id: string }>("/", (req, res) => {
        const loan = loadLoan(db, req);
        const input = parsePaymentRequest(req.body, loan.disbursementDate, true);
        const key = readIdempotencyKey(req);
        const path = `/api/loans/${loan.id}/payments`;

        const result = runIdempotent(
            db,
            key,
            hashRequest("POST", path, req.body),
            () => ({
                status: 201,
                body: confirmPayment(db, loan.id, input),
            })
        );

        if (result.replayed) res.set("Idempotent-Replayed", "true");
        res.status(result.status).type("json").send(result.body);
    });

    return router;
};
