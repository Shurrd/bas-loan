import type { TieOut } from "@lending/shared";
import type { Db } from "@/db";

// Outstanding principal comes from instalment state only. It never reads the journal,
// so comparing it with the statement's closing balance can catch a real disagreement.
const outstandingPrincipal = (db: Db, loanId: bigint) =>
    (
        db
            .prepare(
                "SELECT COALESCE(SUM(principal - principal_paid), 0) AS outstanding FROM loan_instalments WHERE loan_id = ?"
            )
            .get(loanId) as { outstanding: bigint }
    ).outstanding;

export const getTieOut = (db: Db, loanId: bigint, statementBalance: bigint): TieOut => {
    const outstanding = outstandingPrincipal(db, loanId);
    const difference = statementBalance - outstanding;
    return { outstandingPrincipal: outstanding, difference, matches: difference === 0n };
};
