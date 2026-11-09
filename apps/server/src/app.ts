import { join, resolve } from "node:path";
import express from "express";
import type { Db } from "@/db";
import { errorHandler } from "@/middleware/error-handler";
import { invoiceRoutes } from "@/routes/invoices";
import { loanRoutes } from "@/routes/loans";
import { paymentRoutes } from "@/routes/payments";

type AppOptions = {
    /** A built client to serve next to the API, for a deployment that runs as one app */
    clientDir?: string;
};

export const createApp = (db: Db, { clientDir }: AppOptions = {}) => {
    const app = express();
    app.use(express.json());
    app.use("/api/loans/:id/payments", paymentRoutes(db));
    app.use("/api/loans", loanRoutes(db));
    app.use("/api/invoices", invoiceRoutes(db));

    if (clientDir) {
        const root = resolve(clientDir);
        // Built file names carry a hash, so they can be cached for good. index.html cannot.
        app.use(
            "/assets",
            express.static(join(root, "assets"), { immutable: true, maxAge: "1y" })
        );
        app.use(express.static(root));
        // Deep links such as /loans/1 belong to the client's router
        app.use((req, res, next) => {
            if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
            res.sendFile(join(root, "index.html"));
        });
    }

    app.use(errorHandler);
    return app;
};
