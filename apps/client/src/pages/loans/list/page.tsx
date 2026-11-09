import { formatNaira } from "@lending/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import Container from "@/components/shared/container";
import { TopHeader } from "@/components/shared/page-header";
import Panel from "@/components/shared/panel";
import StatusBadge from "@/components/shared/status-badge";
import TableMessage from "@/components/shared/table-message";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { cell, headCell, numCell, tableHead } from "@/lib/style";
import { loanQueries } from "@/services/queries";
import NewLoanDialog from "./_components/new-loan-dialog";

const naira = (kobo: string) => formatNaira(BigInt(kobo));

export default function LoansPage() {
    const { data, error, isPending } = useQuery(loanQueries.list());
    const [open, setOpen] = useState(false);

    return (
        <Container className="gap-6">
            <TopHeader>
                <TopHeader.Title
                    title="Loans"
                    subtitle="Term loans, newest first. Open one to see its schedule, repayments and statement."
                />
                <TopHeader.Actions>
                    <Button label="New loan" onClick={() => setOpen(true)} />
                </TopHeader.Actions>
            </TopHeader>

            <Panel>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={tableHead}>
                                <th className={headCell}>Loan</th>
                                <th className={headCell}>Disbursed</th>
                                <th className={`${headCell} text-right`}>Principal</th>
                                <th className={`${headCell} text-right`}>Rate</th>
                                <th className={`${headCell} text-right`}>Term</th>
                                <th className={`${headCell} text-right`}>
                                    Outstanding principal
                                </th>
                                <th className={headCell}>Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {isPending && (
                                <TableMessage colSpan={7}>Loading...</TableMessage>
                            )}
                            {error && (
                                <TableMessage colSpan={7}>
                                    {errorMessage(error)}
                                </TableMessage>
                            )}
                            {data?.length === 0 && (
                                <TableMessage colSpan={7}>
                                    No loans yet. Use New loan to create the first one.
                                </TableMessage>
                            )}
                            {data?.map((loan) => (
                                <tr key={loan.id}>
                                    <td className={cell}>
                                        <Link
                                            to={`/loans/${loan.id}`}
                                            className="text-primary font-medium underline"
                                        >
                                            Loan {loan.id}
                                        </Link>
                                    </td>
                                    <td className={cell}>{loan.disbursementDate}</td>
                                    <td className={numCell}>{naira(loan.principal)}</td>
                                    <td className={numCell}>{loan.annualRatePercent}%</td>
                                    <td className={numCell}>{loan.termMonths} months</td>
                                    <td className={numCell}>
                                        {naira(loan.outstandingPrincipal)}
                                    </td>
                                    <td className={cell}>
                                        <StatusBadge
                                            status={
                                                BigInt(loan.outstandingPrincipal) === 0n
                                                    ? "Repaid"
                                                    : "Active"
                                            }
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
            <NewLoanDialog open={open} onOpenChange={setOpen} />
        </Container>
    );
}
