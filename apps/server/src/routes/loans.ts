import { Router } from "express";
import type { Db } from "@/db";
import { NotFoundError } from "@/lib/errors";
import { toWire } from "@/lib/wire";
import { hashRequest, readIdempotencyKey, runIdempotent } from "@/services/idempotency";
import { getLoanDetail, getLoanRecord, listLoans, originateLoan } from "@/services/loan";
import { saveQuote } from "@/services/quote";
import { getStatement } from "@/services/statement";
import { buildStatementPdf, statementFileName } from "@/services/statement-pdf";
import { getTieOut } from "@/services/tie-out";
import { parseApprovalRequest, parseLoanRequest } from "@/validators/loan";

export const loanRoutes = (db: Db) => {
    const router = Router();

    router.post("/quote", (req, res) => {
        res.status(201).json(toWire(saveQuote(db, parseLoanRequest(req.body))));
    });

    router.post("/", (req, res) => {
        const quoteId = parseApprovalRequest(req.body);
        const key = readIdempotencyKey(req);
        const result = runIdempotent(
            db,
            key,
            hashRequest("POST", "/api/loans", req.body),
            () => ({
                status: 201,
                body: originateLoan(db, quoteId),
            })
        );

        if (result.replayed) res.set("Idempotent-Replayed", "true");
        res.status(result.status).type("json").send(result.body);
    });

    router.get("/", (_req, res) => {
        res.json(toWire(listLoans(db)));
    });

    router.get("/:id", (req, res) => {
        if (!/^\d+$/.test(req.params.id)) throw new NotFoundError("Loan not found");
        res.json(toWire(getLoanDetail(db, BigInt(req.params.id))));
    });

    router.get("/:id/statement", (req, res) => {
        if (!/^\d+$/.test(req.params.id)) throw new NotFoundError("Loan not found");
        const loan = getLoanRecord(db, BigInt(req.params.id));

        const statement = getStatement(db, loan.id);
        const tieOut = getTieOut(db, loan.id, statement.closingBalance);
        res.json(toWire({ ...statement, tieOut }));
    });

    router.get("/:id/statement.pdf", async (req, res) => {
        if (!/^\d+$/.test(req.params.id)) throw new NotFoundError("Loan not found");
        const loan = getLoanRecord(db, BigInt(req.params.id));

        const statement = getStatement(db, loan.id);
        const tieOut = getTieOut(db, loan.id, statement.closingBalance);
        const pdf = await buildStatementPdf({
            loan,
            statement: { ...statement, tieOut },
            generatedOn: new Date().toISOString().slice(0, 10),
        });

        res.type("application/pdf")
            .set(
                "Content-Disposition",
                `attachment; filename="${statementFileName(loan.id)}"`
            )
            .send(pdf);
    });

    return router;
};
