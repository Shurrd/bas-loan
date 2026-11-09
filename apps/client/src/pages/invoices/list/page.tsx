import { formatNaira } from "@lending/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import Container from "@/components/shared/container";
import { TopHeader } from "@/components/shared/page-header";
import Panel from "@/components/shared/panel";
import StatusBadge from "@/components/shared/status-badge";
import ViewLink from "@/components/shared/view-link";
import TableMessage from "@/components/shared/table-message";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { cell, headCell, numCell, tableHead } from "@/lib/style";
import { invoiceQueries } from "@/services/queries";
import NewInvoiceDialog from "./_components/new-invoice-dialog";

const naira = (kobo: string) => formatNaira(BigInt(kobo));

export default function InvoicesPage() {
    const { data, error, isPending } = useQuery(invoiceQueries.list());
    const [open, setOpen] = useState(false);

    return (
        <Container className="gap-6">
            <TopHeader>
                <TopHeader.Title
                    title="Invoices"
                    subtitle="Financed invoices, newest first. Open one to settle it or see its ledger entries."
                />
                <TopHeader.Actions>
                    <Button label="New invoice" onClick={() => setOpen(true)} />
                </TopHeader.Actions>
            </TopHeader>

            <Panel>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={tableHead}>
                                <th className={headCell}>Invoice</th>
                                <th className={headCell}>Funded</th>
                                <th className={headCell}>Due date</th>
                                <th className={`${headCell} text-right`}>Face value</th>
                                <th className={`${headCell} text-right`}>Advance</th>
                                <th className={`${headCell} text-right`}>Reserve</th>
                                <th className={headCell}>Status</th>
                                <th className={`${headCell} text-right`}>
                                    <span className="sr-only">View</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {isPending && (
                                <TableMessage colSpan={8}>Loading...</TableMessage>
                            )}
                            {error && (
                                <TableMessage colSpan={8}>
                                    {errorMessage(error)}
                                </TableMessage>
                            )}
                            {data?.length === 0 && (
                                <TableMessage colSpan={8}>
                                    No invoices yet. Use New invoice to fund the first
                                    one.
                                </TableMessage>
                            )}
                            {data?.map((invoice) => (
                                <tr key={invoice.id}>
                                    <td className={cell}>
                                        <Link
                                            to={`/invoices/${invoice.id}`}
                                            className="text-primary font-medium underline"
                                        >
                                            Invoice {invoice.id}
                                        </Link>
                                    </td>
                                    <td className={cell}>{invoice.fundingDate}</td>
                                    <td className={cell}>{invoice.dueDate}</td>
                                    <td className={numCell}>
                                        {naira(invoice.faceValue)}
                                    </td>
                                    <td className={numCell}>{naira(invoice.advance)}</td>
                                    <td className={numCell}>{naira(invoice.reserve)}</td>
                                    <td className={cell}>
                                        <StatusBadge
                                            status={invoice.settled ? "Settled" : "Open"}
                                        />
                                    </td>
                                    <td className={`${cell} text-right`}>
                                        <ViewLink
                                            to={`/invoices/${invoice.id}`}
                                            label={`View invoice ${invoice.id}`}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
            <NewInvoiceDialog open={open} onOpenChange={setOpen} />
        </Container>
    );
}
