import { formatNaira } from "@lending/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import Container from "@/components/shared/container";
import { TopHeader } from "@/components/shared/page-header";
import JournalTable from "@/components/shared/journal-table";
import Panel from "@/components/shared/panel";
import Summary from "@/components/shared/summary";
import { buttonVariants } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { loanQueries } from "@/services/queries";
import PaymentForm from "./_components/payment-form";
import ScheduleStateTable from "./_components/schedule-state-table";

export default function LoanDetailPage() {
    const { id = "" } = useParams();
    const { data, error, isPending } = useQuery(loanQueries.detail(id));

    if (isPending) return <p className="text-gray-500">Loading...</p>;
    if (error)
        return (
            <p role="alert" className="error-message">
                {errorMessage(error)}
            </p>
        );

    const { loan, schedule, entries } = data;
    return (
        <Container className="gap-6">
            <TopHeader>
                <TopHeader.Title
                    title={`Loan ${loan.id}`}
                    subtitle="Schedule, repayments and ledger entries."
                />
                <TopHeader.Actions>
                    <Link
                        to={`/loans/${loan.id}/statement`}
                        className={buttonVariants({ variant: "outline" })}
                    >
                        View statement
                    </Link>
                </TopHeader.Actions>
            </TopHeader>

            <Panel title="Loan">
                <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
                    <Summary
                        label="Principal"
                        value={formatNaira(BigInt(loan.principal))}
                    />
                    <Summary label="Annual rate" value={`${loan.annualRatePercent}%`} />
                    <Summary label="Term" value={`${loan.termMonths} months`} />
                    <Summary label="Disbursed" value={loan.disbursementDate} />
                </div>
            </Panel>

            <PaymentForm loan={loan} />

            <Panel title="Schedule">
                <ScheduleStateTable schedule={schedule} />
            </Panel>

            <Panel title="Journal entries">
                <JournalTable entries={entries} />
            </Panel>
        </Container>
    );
}
