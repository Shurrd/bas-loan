import { formatKobo, formatNaira } from "@lending/shared";
import type { StatementResponse } from "@/types/api";

export default function TieOutBanner({ statement }: { statement: StatementResponse }) {
    const { closingBalance, tieOut } = statement;
    const closing = formatNaira(BigInt(closingBalance));
    const outstanding = formatNaira(BigInt(tieOut.outstandingPrincipal));

    if (tieOut.matches) {
        return (
            <p
                role="status"
                className="text-success-700 bg-success-100 rounded-md px-4 py-3 text-sm"
            >
                <span className="font-medium">Tie-out matches.</span> The statement's
                closing balance and the schedule's outstanding principal are both{" "}
                {closing}.
            </p>
        );
    }

    const difference = BigInt(tieOut.difference);
    return (
        <div
            role="alert"
            className="text-danger-700 bg-danger-100 rounded-md px-4 py-3 text-sm"
        >
            <p className="font-medium">
                Tie-out failed. The statement and the schedule disagree.
            </p>
            <ul className="mt-1 list-disc pl-5">
                <li>Statement closing balance: {closing}</li>
                <li>Schedule outstanding principal: {outstanding}</li>
                <li>
                    Difference: {formatKobo(difference)} ({formatNaira(difference)})
                </li>
            </ul>
        </div>
    );
}
