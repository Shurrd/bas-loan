import { formatNaira, type InvoiceRequest } from "@lending/shared";
import { type FormEvent, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DatePicker from "@/components/form/date-picker";
import SelectField from "@/components/form/select-field";
import TextField from "@/components/form/text-field";
import PreviewCheck from "@/components/shared/preview-check";
import Summary from "@/components/shared/summary";
import { Button } from "@/components/ui/button";
import { today } from "@/lib/date";
import { errorField, getFieldErrors, inlineMessage } from "@/lib/errors";
import { newIdempotencyKey } from "@/lib/idempotency";
import { type InvoiceFormValues, toInvoiceRequest } from "@/lib/invoice-form";
import { findInvoiceMismatches, type InvoiceMismatch } from "@/lib/preview";
import { useCreateInvoice, useQuoteInvoice } from "@/services/mutations";
import type { InvoiceQuoteResponse } from "@/types/api";

type Quote = {
    request: InvoiceRequest;
    result: InvoiceQuoteResponse;
    mismatches: InvoiceMismatch[];
};

const TENOR_OPTIONS = [30, 45, 60, 90, 120].map((days) => ({
    value: String(days),
    label: `${days} days`,
}));

const naira = (kobo: string) => formatNaira(BigInt(kobo));

export default function InvoiceForm() {
    const navigate = useNavigate();
    const quoteInvoice = useQuoteInvoice();
    const createInvoice = useCreateInvoice();

    const [values, setValues] = useState<InvoiceFormValues>({
        faceValue: "",
        tenorDays: "",
        fundingDate: today(),
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [quote, setQuote] = useState<Quote | null>(null);
    const [message, setMessage] = useState("");
    const [existingInvoiceId, setExistingInvoiceId] = useState<string>();

    // One key per intended funding: a retry reuses it, a changed form starts a new one
    const key = useRef("");
    const funding = useRef(false);

    const change = (field: keyof InvoiceFormValues) => (value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: "" }));
        setQuote(null);
        setMessage("");
        setExistingInvoiceId(undefined);
    };

    const showErrors = (list: { field: string; message: string }[]) =>
        setErrors(Object.fromEntries(list.map((error) => [error.field, error.message])));

    const requestQuote = (e: FormEvent) => {
        e.preventDefault();
        const { request, errors: formErrors } = toInvoiceRequest(values);
        showErrors(formErrors);
        if (formErrors.length > 0) return;

        quoteInvoice.mutate(request, {
            onSuccess: (result) => {
                key.current = newIdempotencyKey();
                setQuote({
                    request,
                    result,
                    mismatches: findInvoiceMismatches(request, result),
                });
            },
            onError: (error) => {
                const fieldErrors = getFieldErrors(error);
                if (fieldErrors.length > 0) showErrors(fieldErrors);
                else setMessage(inlineMessage(error));
            },
        });
    };

    const fund = () => {
        if (!quote || funding.current) return;
        funding.current = true;
        setMessage("");

        createInvoice.mutate(
            { quoteId: quote.result.quoteId, key: key.current },
            {
                onSuccess: (detail) => navigate(`/invoices/${detail.invoice.id}`),
                onError: (error) => {
                    setMessage(inlineMessage(error));
                    setExistingInvoiceId(errorField(error, "invoiceId"));
                },
                onSettled: () => {
                    funding.current = false;
                },
            }
        );
    };

    return (
        <>
            <form onSubmit={requestQuote} noValidate className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField
                        label="Face value (₦)"
                        name="faceValue"
                        amount
                        value={values.faceValue}
                        onChange={change("faceValue")}
                        error={errors.faceValue}
                        hint="For example 1,000,000.00"
                        inputMode="decimal"
                    />
                    <SelectField
                        label="Tenor (days)"
                        name="tenorDays"
                        value={values.tenorDays}
                        onChange={change("tenorDays")}
                        options={TENOR_OPTIONS}
                        error={errors.tenorDays}
                        allowCustom
                        isValidCustom={(input) => /^\d+$/.test(input)}
                    />
                    <DatePicker
                        label="Funding date"
                        name="fundingDate"
                        value={values.fundingDate}
                        onChange={change("fundingDate")}
                        error={errors.fundingDate}
                    />
                </div>
                <div className="flex justify-end">
                    <Button
                        type="submit"
                        variant={quote ? "outline" : "primary"}
                        label="Get quote"
                        isLoading={quoteInvoice.isPending}
                        loadingText="Getting quote"
                    />
                </div>
            </form>

            {quote && (
                <section className="animate-in fade-in-0 slide-in-from-top-2 flex flex-col gap-4 border-t pt-4 duration-300 ease-out motion-reduce:animate-none">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium">Quote</h3>
                        <Button
                            type="button"
                            size="sm"
                            label="Fund invoice"
                            onClick={fund}
                            disabled={quote.mismatches.length > 0}
                            isLoading={createInvoice.isPending}
                            loadingText="Funding"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Summary
                            label="Face value"
                            value={naira(quote.result.faceValue)}
                        />
                        <Summary label="Advance" value={naira(quote.result.advance)} />
                        <Summary label="Reserve" value={naira(quote.result.reserve)} />
                        <Summary label="Discount fee" value={naira(quote.result.fee)} />
                        <Summary label="Funding date" value={quote.result.fundingDate} />
                        <Summary label="Due date" value={quote.result.dueDate} />
                        <Summary label="Quote" value={quote.result.quoteId} />
                        <Summary label="Source" value="Server quote (official)" />
                    </div>
                    <PreviewCheck
                        lines={quote.mismatches.map(
                            (item) =>
                                `${item.field}: preview ${item.preview}, server ${item.server}`
                        )}
                        blocked="Do not fund this quote."
                    />
                </section>
            )}

            {message && (
                <p role="alert" className="error-message">
                    {message}
                    {existingInvoiceId && (
                        <>
                            {" "}
                            <Link
                                to={`/invoices/${existingInvoiceId}`}
                                className="text-primary underline"
                            >
                                Open invoice {existingInvoiceId}
                            </Link>
                        </>
                    )}
                </p>
            )}
        </>
    );
}
