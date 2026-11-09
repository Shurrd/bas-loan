import { type FormEvent, useRef, useState } from "react";
import DatePicker from "@/components/form/date-picker";
import Panel from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { today } from "@/lib/date";
import { errorField, getFieldErrors, inlineMessage } from "@/lib/errors";
import { newIdempotencyKey } from "@/lib/idempotency";
import { toSettlementRequest } from "@/lib/invoice-form";
import { useConfirmSettlement, usePreviewSettlement } from "@/services/mutations";
import type { InvoiceDetailResponse, SettlementPreviewResponse } from "@/types/api";
import SettlementSummary from "./settlement-summary";

type Preview = { settlementDate: string; result: SettlementPreviewResponse };

export default function SettlementForm({
    invoice,
}: {
    invoice: InvoiceDetailResponse["invoice"];
}) {
    const previewSettlement = usePreviewSettlement();
    const confirmSettlement = useConfirmSettlement();

    const [settlementDate, setSettlementDate] = useState(today());
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<Preview | null>(null);
    const [message, setMessage] = useState("");

    // One key per previewed settlement: a retry reuses it, a changed date starts a new one
    const key = useRef("");
    const confirming = useRef(false);

    const change = (value: string) => {
        setSettlementDate(value);
        setError("");
        setPreview(null);
        setMessage("");
    };

    const requestPreview = (e: FormEvent) => {
        e.preventDefault();
        setMessage("");
        const { request, errors } = toSettlementRequest(
            settlementDate,
            invoice.fundingDate
        );
        setError(errors[0]?.message ?? "");
        if (errors.length > 0) return;

        previewSettlement.mutate(
            { invoiceId: invoice.id, body: request },
            {
                onSuccess: (result) => {
                    key.current = newIdempotencyKey();
                    setPreview({ settlementDate, result });
                },
                onError: (failure) => {
                    const fieldErrors = getFieldErrors(failure);
                    if (fieldErrors.length > 0) setError(fieldErrors[0]!.message);
                    else setMessage(inlineMessage(failure));
                },
            }
        );
    };

    const confirm = () => {
        if (!preview || confirming.current) return;
        confirming.current = true;
        setMessage("");

        confirmSettlement.mutate(
            {
                invoiceId: invoice.id,
                body: { settlementDate: preview.settlementDate },
                key: key.current,
            },
            {
                onError: (failure) => {
                    setMessage(inlineMessage(failure));
                    if (errorField(failure, "code") === "ALREADY_SETTLED")
                        setPreview(null);
                },
                onSettled: () => {
                    confirming.current = false;
                },
            }
        );
    };

    return (
        <Panel title="Settle invoice">
            <form onSubmit={requestPreview} noValidate>
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <DatePicker
                        label="Settlement date"
                        name="settlementDate"
                        value={settlementDate}
                        onChange={change}
                        error={error}
                    />
                </div>
                <p className="text-gray-500 px-4 pb-4 text-xs">
                    The debtor pays the full face value. The server works out the fee,
                    penalty and what is due to the client.
                </p>
                <div className="flex justify-end border-t px-4 py-3">
                    <Button
                        type="submit"
                        variant="outline"
                        label="Preview settlement"
                        isLoading={previewSettlement.isPending}
                        loadingText="Previewing"
                    />
                </div>
            </form>

            {preview && (
                <div className="border-t">
                    <div className="flex items-center justify-between px-4 py-3">
                        <h3 className="text-sm font-medium">
                            Settlement worked out by the server
                        </h3>
                        <Button
                            type="button"
                            size="sm"
                            label="Confirm settlement"
                            onClick={confirm}
                            isLoading={confirmSettlement.isPending}
                            loadingText="Posting"
                        />
                    </div>
                    <SettlementSummary settlement={preview.result.settlement} />
                </div>
            )}

            {message && (
                <p role="alert" className="error-message px-4 pb-3">
                    {message}
                </p>
            )}
        </Panel>
    );
}
