import type { FieldError } from "@lending/shared";

export class LedgerError extends Error {}

export class ValidationError extends Error {
    constructor(public errors: FieldError[]) {
        super("Validation failed");
    }
}

export class ConflictError extends Error {
    constructor(
        message: string,
        public details: Record<string, string> = {}
    ) {
        super(message);
    }
}

export class NotFoundError extends Error {}
