import { formatNaira } from "@lending/shared";
import { cell, headCell, numCell, tableHead } from "@/lib/style";
import type { StatementResponse } from "@/types/api";

const amount = (kobo: string) => (BigInt(kobo) === 0n ? "" : formatNaira(BigInt(kobo)));

export default function StatementTable({ statement }: { statement: StatementResponse }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className={tableHead}>
                        <th className={headCell}>Date</th>
                        <th className={headCell}>Description</th>
                        <th className={headCell}>Account</th>
                        <th className={`${headCell} text-right`}>Debit</th>
                        <th className={`${headCell} text-right`}>Credit</th>
                        <th className={`${headCell} text-right`}>Principal balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {statement.lines.map((line, index) => (
                        <tr key={index}>
                            <td className={cell}>{line.date}</td>
                            <td className={cell}>{line.description}</td>
                            <td className={cell}>{line.accountName}</td>
                            <td className={numCell}>{amount(line.debit)}</td>
                            <td className={numCell}>{amount(line.credit)}</td>
                            <td className={numCell}>
                                {formatNaira(BigInt(line.principalBalance))}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-cloud-300 border-t font-medium">
                        <td className={cell} colSpan={5}>
                            Closing principal balance
                        </td>
                        <td className={numCell}>
                            {formatNaira(BigInt(statement.closingBalance))}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
