import { formatNaira, type LoanRequest } from "@lending/shared";
import { type FormEvent, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DatePicker from "@/components/form/date-picker";
import SelectField from "@/components/form/select-field";
import TextField from "@/components/form/text-field";
import PreviewCheck from "@/components/shared/preview-check";
import ScheduleTable from "@/components/shared/schedule-table";
import Summary from "@/components/shared/summary";
import { Button } from "@/components/ui/button";
import { errorField, getFieldErrors, inlineMessage } from "@/lib/errors";
import { newIdempotencyKey } from "@/lib/idempotency";
import { today } from "@/lib/date";
import { type LoanFormValues, toLoanRequest } from "@/lib/loan-form";
import { findScheduleMismatches, type Mismatch } from "@/lib/preview";
import { useCreateLoan, useQuoteLoan } from "@/services/mutations";
import type { QuoteResponse } from "@/types/api";

type Quote = { request: LoanRequest; result: QuoteResponse; mismatches: Mismatch[] };

const TERM_OPTIONS = [6, 12, 18, 24, 36, 48, 60].map((months) => ({
    value: String(months),
    label: `${months} months`,
}));

const describeMismatch = (item: Mismatch) =>
    `${item.instalment > 0 ? `Instalment ${item.instalment}, ` : ""}${item.field}: preview ${item.preview}, server ${item.server}`;

const naira = (kobo: string) => formatNaira(BigInt(kobo));

export default function LoanForm() {
    const navigate = useNavigate();
    const quoteLoan = useQuoteLoan();
    const createLoan = useCreateLoan();

    const [values, setValues] = useState<LoanFormValues>({
        principal: "",
        annualRatePercent: "",
        termMonths: "",
        disbursementDate: today(),
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [quote, setQuote] = useState<Quote | null>(null);
    const [message, setMessage] = useState("");
    const [existingLoanId, setExistingLoanId] = useState<string>();

    // One key per intended approval: a retry reuses it, a changed form starts a new one
    const key = useRef("");
    const approving = useRef(false);

    const change = (field: keyof LoanFormValues) => (value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: "" }));
        setQuote(null);
        setMessage("");
        setExistingLoanId(undefined);
    };

    const showErrors = (list: { field: string; message: string }[]) =>
        setErrors(Object.fromEntries(list.map((error) => [error.field, error.message])));

    const requestQuote = (e: FormEvent) => {
        e.preventDefault();
        const { request, errors: formErrors } = toLoanRequest(values);
        showErrors(formErrors);
        if (formErrors.length > 0) return;

        quoteLoan.mutate(request, {
            onSuccess: (result) => {
                key.current = newIdempotencyKey();
                setQuote({
                    request,
                    result,
                    mismatches: findScheduleMismatches(request, result.schedule),
                });
            },
            onError: (error) => {
                const fieldErrors = getFieldErrors(error);
                if (fieldErrors.length > 0) showErrors(fieldErrors);
                else setMessage(inlineMessage(error));
            },
        });
    };

    const approve = () => {
        if (!quote || approving.current) return;
        approving.current = true;
        setMessage("");

        createLoan.mutate(
            { quoteId: quote.result.quoteId, key: key.current },
            {
                onSuccess: (detail) => navigate(`/loans/${detail.loan.id}`),
                onError: (error) => {
                    setMessage(inlineMessage(error));
                    setExistingLoanId(errorField(error, "loanId"));
                },
                onSettled: () => {
                    approving.current = false;
                },
            }
        );
    };

    return (
        <>
            <form onSubmit={requestQuote} noValidate className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField
                        label="Principal (₦)"
                        name="principal"
                        amount
                        value={values.principal}
                        onChange={change("principal")}
                        error={errors.principal}
                        hint="For example 1,200,000.00"
                        inputMode="decimal"
                    />
                    <TextField
                        label="Annual rate (%)"
                        name="annualRatePercent"
                        value={values.annualRatePercent}
                        onChange={change("annualRatePercent")}
                        error={errors.annualRatePercent}
                        hint="For example 18.75"
                        inputMode="decimal"
                    />
                    <SelectField
                        label="Term (months)"
                        name="termMonths"
                        value={values.termMonths}
                        onChange={change("termMonths")}
                        options={TERM_OPTIONS}
                        error={errors.termMonths}
                        allowCustom
                        isValidCustom={(input) => /^\d+$/.test(input)}
                    />
                    <DatePicker
                        label="Disbursement date"
                        name="disbursementDate"
                        value={values.disbursementDate}
                        onChange={change("disbursementDate")}
                        error={errors.disbursementDate}
                    />
                </div>
                <div className="flex justify-end">
                    <Button
                        type="submit"
                        variant={quote ? "outline" : "primary"}
                        label="Get quote"
                        isLoading={quoteLoan.isPending}
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
                            label="Approve and disburse"
                            onClick={approve}
                            disabled={quote.mismatches.length > 0}
                            isLoading={createLoan.isPending}
                            loadingText="Disbursing"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Summary
                            label="Instalment"
                            value={naira(quote.result.schedule[0]?.payment ?? "0")}
                        />
                        <Summary
                            label="Total interest"
                            value={naira(quote.result.totalInterest)}
                        />
                        <Summary label="Quote" value={quote.result.quoteId} />
                        <Summary label="Source" value="Server quote (official)" />
                    </div>
                    <PreviewCheck
                        lines={quote.mismatches.map(describeMismatch)}
                        blocked="Do not approve this quote."
                    />
                    <div className="max-h-64 overflow-y-auto">
                        <ScheduleTable schedule={quote.result.schedule} />
                    </div>
                </section>
            )}

            {message && (
                <p role="alert" className="error-message">
                    {message}
                    {existingLoanId && (
                        <>
                            {" "}
                            <Link
                                to={`/loans/${existingLoanId}`}
                                className="text-primary underline"
                            >
                                Open loan {existingLoanId}
                            </Link>
                        </>
                    )}
                </p>
            )}
        </>
    );
}
