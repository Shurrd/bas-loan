import { formatNaira } from "@lending/shared";
import Panel from "@/components/shared/panel";
import { cell, headCell, numCell, tableHead } from "@/lib/style";
import type { InstalmentResponse } from "@/types/api";

const naira = (kobo: string) => formatNaira(BigInt(kobo));

export default function ScheduleTable({ schedule }: { schedule: InstalmentResponse[] }) {
    return (
        <Panel>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className={tableHead}>
                            <th className={headCell}>#</th>
                            <th className={headCell}>Due date</th>
                            <th className={`${headCell} text-right`}>Payment</th>
                            <th className={`${headCell} text-right`}>Interest</th>
                            <th className={`${headCell} text-right`}>Principal</th>
                            <th className={`${headCell} text-right`}>Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {schedule.map((row) => (
                            <tr key={row.number}>
                                <td className={cell}>{row.number}</td>
                                <td className={cell}>{row.dueDate}</td>
                                <td className={numCell}>{naira(row.payment)}</td>
                                <td className={numCell}>{naira(row.interest)}</td>
                                <td className={numCell}>{naira(row.principal)}</td>
                                <td className={numCell}>{naira(row.closingBalance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}
