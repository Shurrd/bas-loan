import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmSettlement, getInvoice, previewSettlement } from "@/services/func";
import { wireInvoice, wireSettlement } from "@/test/fixtures";
import { pickDate } from "@/test/pick";
import { renderWithProviders } from "@/test/render";
import InvoiceDetailPage from "./page";

vi.mock("@/services/func");

const render = (route = "/invoices/1") =>
    renderWithProviders(
        <Routes>
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        </Routes>,
        route
    );

describe("InvoiceDetailPage", () => {
    beforeEach(() => vi.resetAllMocks());

    it("shows an open invoice with its advance entry and a settlement form", async () => {
        vi.mocked(getInvoice).mockResolvedValue(wireInvoice());
        render();

        expect(
            await screen.findByRole("heading", { name: "Invoice 1" })
        ).toBeInTheDocument();
        expect(getInvoice).toHaveBeenCalledWith("1");
        expect(screen.getByText("Open")).toBeInTheDocument();
        expect(screen.getByLabelText("Settlement date")).toBeInTheDocument();

        const receivables = screen.getByRole("row", { name: /Invoice Receivables/ });
        const cells = within(receivables).getAllByRole("cell");
        expect(cells.at(-2)).toHaveTextContent("₦800,000.00");
        expect(cells.at(-1)).toBeEmptyDOMElement();
    });

    it("shows a settled invoice with its shortfall and no settlement form", async () => {
        vi.mocked(getInvoice).mockResolvedValue(wireInvoice("2025-06-05"));
        render();

        expect(await screen.findByText("Settled")).toBeInTheDocument();
        expect(screen.queryByLabelText("Settlement date")).not.toBeInTheDocument();
        expect(screen.getByText("Shortfall owed by the client")).toBeInTheDocument();
        expect(screen.getByText("₦942.47")).toBeInTheDocument();
    });

    it("shows an error when the invoice cannot be loaded", async () => {
        vi.mocked(getInvoice).mockRejectedValue(new Error("boom"));
        render("/invoices/9");
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Something went wrong"
        );
    });

    it("refreshes from the server after the settlement is confirmed", async () => {
        const settled = wireInvoice("2025-06-05");
        settled.entries.push({
            id: "2",
            kind: "invoice_settlement",
            entryDate: "2025-06-05",
            reversesEntryId: null,
            lines: [
                {
                    account: "CASH",
                    accountName: "Cash",
                    side: "debit",
                    amount: "100000000",
                },
                {
                    account: "CLIENT_RECEIVABLE",
                    accountName: "Client Receivable",
                    side: "debit",
                    amount: "94247",
                },
            ],
        });
        vi.mocked(getInvoice)
            .mockResolvedValueOnce(wireInvoice())
            .mockResolvedValue(settled);
        vi.mocked(previewSettlement).mockResolvedValue({
            settlement: wireSettlement("2025-06-05"),
        });
        vi.mocked(confirmSettlement).mockResolvedValue({
            settlement: wireSettlement("2025-06-05"),
            entry: settled.entries[1]!,
        });

        const user = userEvent.setup();
        render();
        await screen.findByRole("heading", { name: "Invoice 1" });
        expect(screen.getByText("Open")).toBeInTheDocument();

        await pickDate(user, "Settlement date", "2025-06-05");
        await user.click(screen.getByRole("button", { name: "Preview settlement" }));
        await user.click(
            await screen.findByRole("button", { name: "Confirm settlement" })
        );

        await waitFor(() => expect(screen.getByText("Settled")).toBeInTheDocument());
        expect(getInvoice).toHaveBeenCalledTimes(2);
        expect(
            screen.queryByRole("button", { name: "Confirm settlement" })
        ).not.toBeInTheDocument();
        expect(screen.getByRole("row", { name: /Client Receivable/ })).toHaveTextContent(
            "₦942.47"
        );
    });
});
