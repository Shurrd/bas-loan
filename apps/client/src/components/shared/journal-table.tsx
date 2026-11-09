import { formatNaira } from "@lending/shared";
import { cell, headCell, numCell, tableHead } from "@/lib/style";
import type { LoanDetailResponse } from "@/types/api";

export default function JournalTable({
    entries,
}: {
    entries: LoanDetailResponse["entries"];
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className={tableHead}>
                        <th className={headCell}>Entry</th>
                        <th className={headCell}>Date</th>
                        <th className={headCell}>Type</th>
                        <th className={headCell}>Account</th>
                        <th className={`${headCell} text-right`}>Debit</th>
                        <th className={`${headCell} text-right`}>Credit</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {entries.flatMap((entry) =>
                        entry.lines.map((line, index) => (
                            <tr key={`${entry.id}-${index}`}>
                                <td className={cell}>{index === 0 ? entry.id : ""}</td>
                                <td className={cell}>
                                    {index === 0 ? entry.entryDate : ""}
                                </td>
                                <td className={cell}>{index === 0 ? entry.kind : ""}</td>
                                <td className={cell}>{line.accountName}</td>
                                <td className={numCell}>
                                    {line.side === "debit"
                                        ? formatNaira(BigInt(line.amount))
                                        : ""}
                                </td>
                                <td className={numCell}>
                                    {line.side === "credit"
                                        ? formatNaira(BigInt(line.amount))
                                        : ""}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
