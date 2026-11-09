import { formatNaira, type PaymentRequest } from "@lending/shared";
import { type FormEvent, useRef, useState } from "react";
import DatePicker from "@/components/form/date-picker";
import TextField from "@/components/form/text-field";
import Panel from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { errorField, getFieldErrors, inlineMessage } from "@/lib/errors";
import { newIdempotencyKey } from "@/lib/idempotency";
import { today } from "@/lib/date";
import { type PaymentFormValues, toPaymentRequest } from "@/lib/payment-form";
import { useConfirmPayment, usePreviewPayment } from "@/services/mutations";
import type { LoanDetailResponse, PaymentPreviewResponse } from "@/types/api";
import AllocationTable from "./allocation-table";

type Preview = { request: PaymentRequest; result: PaymentPreviewResponse };

export default function PaymentForm({ loan }: { loan: LoanDetailResponse["loan"] }) {
    const previewPayment = usePreviewPayment();
    const confirmPayment = useConfirmPayment();

    const [values, setValues] = useState<PaymentFormValues>({
        amount: "",
        paymentDate: today(),
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [preview, setPreview] = useState<Preview | null>(null);
    const [message, setMessage] = useState("");
    const [posted, setPosted] = useState("");

    // One key per previewed payment: a retry reuses it, any edit starts a new one
    const key = useRef("");
    const confirming = useRef(false);

    const change = (field: keyof PaymentFormValues) => (value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: "" }));
        setPreview(null);
        setMessage("");
        setPosted("");
    };

    const showErrors = (list: { field: string; message: string }[]) =>
        setErrors(Object.fromEntries(list.map((error) => [error.field, error.message])));

    const requestPreview = (e: FormEvent) => {
        e.preventDefault();
        setPosted("");
        setMessage("");
        const { request, errors: formErrors } = toPaymentRequest(
            values,
            loan.disbursementDate
        );
        showErrors(formErrors);
        if (formErrors.length > 0) return;

        previewPayment.mutate(
            { loanId: loan.id, body: request },
            {
                onSuccess: (result) => {
                    key.current = newIdempotencyKey();
                    setPreview({ request, result });
                },
                onError: (error) => {
                    const fieldErrors = getFieldErrors(error);
                    if (fieldErrors.length > 0) showErrors(fieldErrors);
                    else setMessage(inlineMessage(error));
                },
            }
        );
    };

    const confirm = () => {
        if (!preview || confirming.current) return;
        confirming.current = true;
        setMessage("");

        confirmPayment.mutate(
            {
                loanId: loan.id,
                body: { ...preview.request, stateVersion: preview.result.stateVersion },
                key: key.current,
            },
            {
                onSuccess: (result) => {
                    setPosted(
                        `Payment of ${formatNaira(BigInt(result.allocation.received))} posted as entry ${result.entry.id}.`
                    );
                    setPreview(null);
                    setValues((current) => ({ ...current, amount: "" }));
                },
                onError: (error) => {
                    setMessage(inlineMessage(error));
                    if (errorField(error, "code") === "STATE_CHANGED") setPreview(null);
                },
                onSettled: () => {
                    confirming.current = false;
                },
            }
        );
    };

    return (
        <Panel title="Record payment">
            <form onSubmit={requestPreview} noValidate>
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <TextField
                        label="Amount (₦)"
                        name="amount"
                        amount
                        value={values.amount}
                        onChange={change("amount")}
                        error={errors.amount}
                        hint="For example 50,000.00"
                        inputMode="decimal"
                    />
                    <DatePicker
                        label="Payment date"
                        name="paymentDate"
                        value={values.paymentDate}
                        onChange={change("paymentDate")}
                        error={errors.paymentDate}
                    />
                </div>
                <div className="flex justify-end border-t px-4 py-3">
                    <Button
                        type="submit"
                        variant="outline"
                        label="Preview allocation"
                        isLoading={previewPayment.isPending}
                        loadingText="Previewing"
                    />
                </div>
            </form>

            {preview && (
                <div className="border-t">
                    <div className="flex items-center justify-between px-4 py-3">
                        <h3 className="text-sm font-medium">
                            Allocation worked out by the server
                        </h3>
                        <Button
                            type="button"
                            size="sm"
                            label="Confirm payment"
                            onClick={confirm}
                            isLoading={confirmPayment.isPending}
                            loadingText="Posting"
                        />
                    </div>
                    <AllocationTable allocation={preview.result.allocation} />
                </div>
            )}

            {message && (
                <p role="alert" className="error-message px-4 pb-3">
                    {message}
                </p>
            )}
            {posted && (
                <p role="status" className="text-success-700 px-4 pb-3 text-sm">
                    {posted}
                </p>
            )}
        </Panel>
    );
}
