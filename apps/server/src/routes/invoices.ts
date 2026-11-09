import { Router, type Request } from "express";
import type { Db } from "@/db";
import { NotFoundError } from "@/lib/errors";
import { toWire } from "@/lib/wire";
import { hashRequest, readIdempotencyKey, runIdempotent } from "@/services/idempotency";
import {
    confirmSettlement,
    fundInvoice,
    getInvoiceDetail,
    getInvoiceRecord,
    listInvoices,
    previewSettlement,
} from "@/services/invoice";
import { saveInvoiceQuote } from "@/services/invoice-quote";
import { parseApprovalRequest } from "@/validators/loan";
import { parseInvoiceRequest, parseSettlementRequest } from "@/validators/invoice";

const loadInvoice = (db: Db, req: Request<{ id: string }>) => {
    if (!/^\d+$/.test(req.params.id)) throw new NotFoundError("Invoice not found");
    return getInvoiceRecord(db, BigInt(req.params.id));
};

export const invoiceRoutes = (db: Db) => {
    const router = Router();

    router.post("/quote", (req, res) => {
        res.status(201).json(toWire(saveInvoiceQuote(db, parseInvoiceRequest(req.body))));
    });

    router.post("/", (req, res) => {
        const quoteId = parseApprovalRequest(req.body);
        const key = readIdempotencyKey(req);
        const result = runIdempotent(
            db,
            key,
            hashRequest("POST", "/api/invoices", req.body),
            () => ({
                status: 201,
                body: fundInvoice(db, quoteId),
            })
        );

        if (result.replayed) res.set("Idempotent-Replayed", "true");
        res.status(result.status).type("json").send(result.body);
    });

    router.get("/", (_req, res) => {
        res.json(toWire(listInvoices(db)));
    });

    router.get("/:id", (req, res) => {
        if (!/^\d+$/.test(req.params.id)) throw new NotFoundError("Invoice not found");
        res.json(toWire(getInvoiceDetail(db, BigInt(req.params.id))));
    });

    router.post<"/:id/settlement/preview", { id: string }>(
        "/:id/settlement/preview",
        (req, res) => {
            const invoice = loadInvoice(db, req);
            const settlementDate = parseSettlementRequest(req.body, invoice.fundingDate);
            res.json(toWire(previewSettlement(db, invoice.id, settlementDate)));
        }
    );

    router.post<"/:id/settlement", { id: string }>("/:id/settlement", (req, res) => {
        const invoice = loadInvoice(db, req);
        const settlementDate = parseSettlementRequest(req.body, invoice.fundingDate);
        const key = readIdempotencyKey(req);
        const path = `/api/invoices/${invoice.id}/settlement`;

        const result = runIdempotent(
            db,
            key,
            hashRequest("POST", path, req.body),
            () => ({
                status: 201,
                body: confirmSettlement(db, invoice.id, settlementDate),
            })
        );

        if (result.replayed) res.set("Idempotent-Replayed", "true");
        res.status(result.status).type("json").send(result.body);
    });

    return router;
};
