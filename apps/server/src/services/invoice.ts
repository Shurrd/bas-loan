import type { Db } from "@/db";

type NewInvoice = {
    faceValue: bigint;
    tenorDays: number;
    advanceDate: string;
    dueDate: string;
};

export const createInvoice = (db: Db, invoice: NewInvoice) =>
    BigInt(
        db
            .prepare(
                `INSERT INTO invoices (face_value, tenor_days, advance_date, due_date)
                 VALUES (?, ?, ?, ?)`
            )
            .run(
                invoice.faceValue,
                invoice.tenorDays,
                invoice.advanceDate,
                invoice.dueDate
            ).lastInsertRowid
    );
