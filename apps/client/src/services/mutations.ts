import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveBlob } from "@/lib/download";
import { isServerProblem } from "@/lib/errors";
import {
    confirmPayment,
    confirmSettlement,
    createInvoice,
    createLoan,
    downloadStatementPdf,
    previewPayment,
    previewSettlement,
    quoteInvoice,
    quoteLoan,
} from "./func";
import QueryKeys from "./query-keys";

export const useQuoteLoan = () => useMutation({ mutationFn: quoteLoan });

export const useCreateLoan = () => useMutation({ mutationFn: createLoan });

export const usePreviewPayment = () => useMutation({ mutationFn: previewPayment });

// The schedule, journal and statement on screen come from the server, so a posted payment refetches them
export const useConfirmPayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: confirmPayment,
        onSettled: (_data, _error, { loanId }) =>
            Promise.all(
                [QueryKeys.LOAN, QueryKeys.STATEMENT].map((key) =>
                    queryClient.invalidateQueries({ queryKey: [key, loanId] })
                )
            ),
    });
};

export const useQuoteInvoice = () => useMutation({ mutationFn: quoteInvoice });

export const useCreateInvoice = () => useMutation({ mutationFn: createInvoice });

export const usePreviewSettlement = () => useMutation({ mutationFn: previewSettlement });

export const useConfirmSettlement = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: confirmSettlement,
        onSettled: (_data, _error, { invoiceId }) =>
            queryClient.invalidateQueries({ queryKey: [QueryKeys.INVOICE, invoiceId] }),
    });
};

// A down or broken server already shows as a toast, so only other failures are reported here
export const useDownloadStatement = () =>
    useMutation({
        mutationFn: async (loanId: string) => {
            const { blob, fileName } = await downloadStatementPdf(loanId);
            saveBlob(blob, fileName);
        },
        onError: (error) => {
            if (!isServerProblem(error))
                toast.error("Couldn't prepare the PDF. Try again.");
        },
    });
