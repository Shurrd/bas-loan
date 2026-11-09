import { formatNaira } from "@lending/shared";
import Summary from "@/components/shared/summary";
import type { SettlementResponse } from "@/types/api";

const naira = (kobo: bigint) => formatNaira(kobo);

// A payable amount is never shown below zero: a shortfall is its own figure
const atLeastZero = (kobo: string) => {
    const value = BigInt(kobo);
    return value < 0n ? 0n : value;
};

export default function SettlementSummary({
    settlement,
}: {
    settlement: SettlementResponse;
}) {
    const shortfall = atLeastZero(settlement.shortfall);

    return (
        <>
            <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
                <Summary
                    label="Paid by debtor (face value)"
                    value={naira(BigInt(settlement.faceValue))}
                />
                <Summary label="Advance" value={naira(BigInt(settlement.advance))} />
                <Summary label="Reserve" value={naira(BigInt(settlement.reserve))} />
                <Summary label="Discount fee" value={naira(BigInt(settlement.fee))} />
                <Summary label="Due date" value={settlement.dueDate} />
                <Summary label="Settlement date" value={settlement.settlementDate} />
                <Summary label="Days overdue" value={String(settlement.overdueDays)} />
                <Summary label="Late penalty" value={naira(BigInt(settlement.penalty))} />
            </div>
            <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
                <Summary
                    label="Payable to client"
                    value={naira(atLeastZero(settlement.payableToClient))}
                />
                {shortfall > 0n && (
                    <div className="text-danger-700 bg-danger-100 rounded-md px-3 py-2">
                        <p className="text-xs uppercase">Shortfall owed by the client</p>
                        <p className="text-sm font-medium">{naira(shortfall)}</p>
                        <p className="mt-1 text-xs">
                            The fee and penalty are more than the reserve, so nothing is
                            payable to the client.
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
