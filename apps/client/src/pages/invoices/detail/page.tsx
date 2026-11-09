import { formatNaira } from "@lending/shared";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import Container from "@/components/shared/container";
import JournalTable from "@/components/shared/journal-table";
import { TopHeader } from "@/components/shared/page-header";
import Panel from "@/components/shared/panel";
import StatusBadge from "@/components/shared/status-badge";
import Summary from "@/components/shared/summary";
import { errorMessage } from "@/lib/errors";
import { invoiceQueries } from "@/services/queries";
import SettlementForm from "./_components/settlement-form";
import SettlementSummary from "./_components/settlement-summary";

const naira = (kobo: string) => formatNaira(BigInt(kobo));

export default function InvoiceDetailPage() {
    const { id = "" } = useParams();
    const { data, error, isPending } = useQuery(invoiceQueries.detail(id));

    if (isPending) return <p className="text-gray-500">Loading...</p>;
    if (error)
        return (
            <p role="alert" className="error-message">
                {errorMessage(error)}
            </p>
        );

    const { invoice, settlement, entries } = data;
    return (
        <Container className="gap-6">
            <TopHeader>
                <TopHeader.Title
                    title={`Invoice ${invoice.id}`}
                    subtitle="Advance, settlement and ledger entries."
                />
                <TopHeader.Actions>
                    <StatusBadge status={settlement ? "Settled" : "Open"} />
                </TopHeader.Actions>
            </TopHeader>

            <Panel title="Invoice">
                <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
                    <Summary label="Face value" value={naira(invoice.faceValue)} />
                    <Summary label="Advance" value={naira(invoice.advance)} />
                    <Summary label="Reserve" value={naira(invoice.reserve)} />
                    <Summary label="Discount fee" value={naira(invoice.fee)} />
                    <Summary label="Funded" value={invoice.fundingDate} />
                    <Summary label="Tenor" value={`${invoice.tenorDays} days`} />
                    <Summary label="Due date" value={invoice.dueDate} />
                </div>
            </Panel>

            {settlement ? (
                <Panel title="Settlement">
                    <SettlementSummary settlement={settlement} />
                </Panel>
            ) : (
                <SettlementForm invoice={invoice} />
            )}

            <Panel title="Journal entries">
                <JournalTable entries={entries} />
            </Panel>
        </Container>
    );
}
