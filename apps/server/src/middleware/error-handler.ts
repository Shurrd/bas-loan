import type { ErrorRequestHandler } from "express";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ValidationError) {
        res.status(400).json({ errors: error.errors });
    } else if (error instanceof ConflictError) {
        res.status(409).json({ message: error.message, ...error.details });
    } else if (error instanceof NotFoundError) {
        res.status(404).json({ message: error.message });
    } else if (error?.type === "entity.parse.failed") {
        res.status(400).json({ message: "Request body is not valid JSON" });
    } else {
        console.error(error);
        res.status(500).json({ message: "Something went wrong" });
    }
};
