import {
    allocatePayment,
    type PaymentPreview,
    type PaymentResult,
} from "@lending/shared";
import type { Db } from "@/db";
import { ConflictError } from "@/lib/errors";
import { getInstalmentStates, getJournalEntries, getLoanRecord } from "@/services/loan";
import { postEntry } from "@/services/ledger";
import { paymentLines } from "@/services/posting";

type PaymentInput = { amount: bigint; paymentDate: string };

// Every change to a loan posts a journal entry, so the latest entry id is its version
const loanStateVersion = (db: Db, loanId: bigint) =>
    (
        db
            .prepare(
                "SELECT COALESCE(MAX(id), 0) AS version FROM journal_entries WHERE loan_id = ?"
            )
            .get(loanId) as { version: bigint }
    ).version;

export const previewPayment = (
    db: Db,
    loanId: bigint,
    input: PaymentInput
): PaymentPreview => {
    const loan = getLoanRecord(db, loanId);
    return {
        stateVersion: loanStateVersion(db, loanId),
        allocation: allocatePayment(
            getInstalmentStates(db, loan),
            input.amount,
            input.paymentDate
        ),
    };
};

// The allocation is recomputed here from current state. The client only sends the amount,
// the date and the version it previewed, so a different allocation can never be posted.
export const confirmPayment = (
    db: Db,
    loanId: bigint,
    input: PaymentInput & { stateVersion: bigint }
) =>
    db.transaction((): PaymentResult => {
        if (loanStateVersion(db, loanId) !== input.stateVersion) {
            throw new ConflictError(
                "This loan changed after the preview. Preview the payment again.",
                {
                    code: "STATE_CHANGED",
                }
            );
        }

        const { allocation } = previewPayment(db, loanId, input);
        const entryId = postEntry(db, {
            kind: "payment",
            entryDate: input.paymentDate,
            loanId,
            lines: paymentLines(allocation),
        });

        const markPaid = db.prepare(
            `UPDATE loan_instalments
             SET penalty_paid = penalty_paid + ?, fee_paid = fee_paid + ?,
                 interest_paid = interest_paid + ?, principal_paid = principal_paid + ?
             WHERE loan_id = ? AND number = ?`
        );
        for (const line of allocation.lines) {
            markPaid.run(
                line.penalty,
                line.fee,
                line.interest,
                line.principal,
                loanId,
                line.number
            );
        }

        return {
            stateVersion: loanStateVersion(db, loanId),
            allocation,
            entry: getJournalEntries(db, "id", entryId)[0]!,
        };
    })();
