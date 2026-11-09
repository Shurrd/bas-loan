import { queryOptions } from "@tanstack/react-query";
import { getInvoice, getInvoices, getLoan, getLoans, getStatement } from "./func";
import QueryKeys from "./query-keys";

export const loanQueries = {
    list: () => queryOptions({ queryKey: [QueryKeys.LOANS], queryFn: getLoans }),
    detail: (id: string) =>
        queryOptions({ queryKey: [QueryKeys.LOAN, id], queryFn: () => getLoan(id) }),
};

export const invoiceQueries = {
    list: () => queryOptions({ queryKey: [QueryKeys.INVOICES], queryFn: getInvoices }),
    detail: (id: string) =>
        queryOptions({
            queryKey: [QueryKeys.INVOICE, id],
            queryFn: () => getInvoice(id),
        }),
};

export const statementQueries = {
    detail: (loanId: string) =>
        queryOptions({
            queryKey: [QueryKeys.STATEMENT, loanId],
            queryFn: () => getStatement(loanId),
        }),
};
