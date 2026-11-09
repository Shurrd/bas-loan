import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Container from "@/components/shared/container";
import { TopHeader } from "@/components/shared/page-header";
import Panel from "@/components/shared/panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { useDownloadStatement } from "@/services/mutations";
import { statementQueries } from "@/services/queries";
import StatementTable from "./_components/statement-table";
import TieOutBanner from "./_components/tie-out-banner";

export default function StatementPage() {
    const { id = "" } = useParams();
    const { data, error, isPending } = useQuery(statementQueries.detail(id));
    const download = useDownloadStatement();

    return (
        <Container className="gap-6">
            <TopHeader>
                <TopHeader.Title
                    title={`Statement for loan ${id}`}
                    subtitle="Built from the loan's ledger lines, with a running principal balance."
                />
                <TopHeader.Actions>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => download.mutate(id)}
                        isLoading={download.isPending}
                        loadingText="Preparing PDF"
                        disabled={!data}
                    >
                        <Download className="mr-1.5 size-4" />
                        Download PDF
                    </Button>
                    <Link
                        to={`/loans/${id}`}
                        className={buttonVariants({ variant: "outline" })}
                    >
                        Back to loan
                    </Link>
                </TopHeader.Actions>
            </TopHeader>

            {isPending && <p className="text-gray-500">Loading...</p>}
            {error && (
                <p role="alert" className="error-message">
                    {errorMessage(error)}
                </p>
            )}
            {data && (
                <>
                    <TieOutBanner statement={data} />
                    <Panel title="Ledger lines">
                        <StatementTable statement={data} />
                    </Panel>
                </>
            )}
        </Container>
    );
}
