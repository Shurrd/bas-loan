import { formatNaira } from "@lending/shared";
import StatusBadge from "@/components/shared/status-badge";
import { cell, headCell, numCell, tableHead } from "@/lib/style";
import type { InstalmentStateResponse } from "@/types/api";

const naira = (kobo: bigint) => formatNaira(kobo);

const standing = (item: InstalmentStateResponse) => {
    const due =
        BigInt(item.interest) +
        BigInt(item.principal) +
        BigInt(item.penaltyDue) +
        BigInt(item.feeDue);
    const paid =
        BigInt(item.interestPaid) +
        BigInt(item.principalPaid) +
        BigInt(item.penaltyPaid) +
        BigInt(item.feePaid);
    const status = paid === due ? "Paid" : paid > 0n ? "Part paid" : "Unpaid";
    return { paid, outstanding: due - paid, status };
};

export default function ScheduleStateTable({
    schedule,
}: {
    schedule: InstalmentStateResponse[];
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className={tableHead}>
                        <th className={headCell}>#</th>
                        <th className={headCell}>Due date</th>
                        <th className={`${headCell} text-right`}>Interest</th>
                        <th className={`${headCell} text-right`}>Principal</th>
                        <th className={`${headCell} text-right`}>Paid</th>
                        <th className={`${headCell} text-right`}>Outstanding</th>
                        <th className={headCell}>Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {schedule.map((item) => {
                        const { paid, outstanding, status } = standing(item);
                        return (
                            <tr key={item.number}>
                                <td className={cell}>{item.number}</td>
                                <td className={cell}>{item.dueDate}</td>
                                <td className={numCell}>
                                    {naira(BigInt(item.interest))}
                                </td>
                                <td className={numCell}>
                                    {naira(BigInt(item.principal))}
                                </td>
                                <td className={numCell}>{naira(paid)}</td>
                                <td className={numCell}>{naira(outstanding)}</td>
                                <td className={cell}>
                                    <StatusBadge status={status} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
