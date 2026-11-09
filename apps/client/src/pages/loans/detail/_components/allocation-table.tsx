import { formatNaira } from "@lending/shared";
import { cell, headCell, numCell, tableHead } from "@/lib/style";
import type { PaymentPreviewResponse } from "@/types/api";

const naira = (kobo: string) => formatNaira(BigInt(kobo));

export default function AllocationTable({
    allocation,
}: {
    allocation: PaymentPreviewResponse["allocation"];
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className={tableHead}>
                        <th className={headCell}>Applied to</th>
                        <th className={`${headCell} text-right`}>Penalty</th>
                        <th className={`${headCell} text-right`}>Fee</th>
                        <th className={`${headCell} text-right`}>Interest</th>
                        <th className={`${headCell} text-right`}>Principal</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {allocation.lines.map((line) => (
                        <tr key={line.number}>
                            <td className={cell}>Instalment {line.number}</td>
                            <td className={numCell}>{naira(line.penalty)}</td>
                            <td className={numCell}>{naira(line.fee)}</td>
                            <td className={numCell}>{naira(line.interest)}</td>
                            <td className={numCell}>{naira(line.principal)}</td>
                        </tr>
                    ))}
                    {allocation.lines.length === 0 && (
                        <tr>
                            <td
                                colSpan={5}
                                className="text-gray-500 px-4 py-6 text-center"
                            >
                                Nothing is due on this date, so no instalment is paid.
                            </td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr className="bg-cloud-300 border-t font-medium">
                        <td className={cell}>Total applied</td>
                        <td className={numCell}>{naira(allocation.penalty)}</td>
                        <td className={numCell}>{naira(allocation.fee)}</td>
                        <td className={numCell}>{naira(allocation.interest)}</td>
                        <td className={numCell}>{naira(allocation.principal)}</td>
                    </tr>
                    <tr className="border-t font-medium">
                        <td className={cell} colSpan={4}>
                            Unapplied credit
                        </td>
                        <td className={numCell}>{naira(allocation.unapplied)}</td>
                    </tr>
                    <tr className="border-t font-medium">
                        <td className={cell} colSpan={4}>
                            Received
                        </td>
                        <td className={numCell}>{naira(allocation.received)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
