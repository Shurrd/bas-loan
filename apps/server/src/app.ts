import express from "express";
import type { Db } from "@/db";
import { errorHandler } from "@/middleware/error-handler";
import { invoiceRoutes } from "@/routes/invoices";
import { loanRoutes } from "@/routes/loans";
import { paymentRoutes } from "@/routes/payments";

export const createApp = (db: Db) => {
    const app = express();
    app.use(express.json());
    app.use("/api/loans/:id/payments", paymentRoutes(db));
    app.use("/api/loans", loanRoutes(db));
    app.use("/api/invoices", invoiceRoutes(db));
    app.use(errorHandler);
    return app;
};
