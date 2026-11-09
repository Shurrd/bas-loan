import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInvoice, getInvoices, quoteInvoice } from "@/services/func";
import { wireInvoice, wireInvoiceQuote, wireInvoiceSummaries } from "@/test/fixtures";
import { chooseOption, pickDate } from "@/test/pick";
import { renderWithProviders } from "@/test/render";
import InvoicesPage from "./page";

vi.mock("@/services/func");

const cellsOf = (row: HTMLElement) =>
    within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent);

describe("InvoicesPage", () => {
    beforeEach(() => vi.resetAllMocks());

    it("lists each invoice with its amounts and whether it is open or settled", async () => {
        vi.mocked(getInvoices).mockResolvedValue(wireInvoiceSummaries());
        renderWithProviders(<InvoicesPage />);

        expect(cellsOf(await screen.findByRole("row", { name: /Invoice 2/ }))).toEqual([
            "Invoice 2",
            "2024-12-31",
            "2025-03-01",
            "₦1,000,000.00",
            "₦800,000.00",
            "₦200,000.00",
            "Settled",
            "",
        ]);
        expect(cellsOf(screen.getByRole("row", { name: /Invoice 1/ }))).toEqual([
            "Invoice 1",
            "2024-12-31",
            "2025-03-01",
            "₦500,000.00",
            "₦400,000.00",
            "₦100,000.00",
            "Open",
            "",
        ]);
    });

    it("has an eye on each row that opens that invoice", async () => {
        vi.mocked(getInvoices).mockResolvedValue(wireInvoiceSummaries());
        renderWithProviders(<InvoicesPage />);

        const eye = await screen.findByRole("link", { name: "View invoice 2" });
        expect(eye).toHaveAttribute("href", "/invoices/2");
        expect(eye).toHaveAttribute("title", "View invoice 2");
        expect(screen.getByRole("link", { name: "View invoice 1" })).toHaveAttribute(
            "href",
            "/invoices/1"
        );
        expect(screen.getAllByRole("link", { name: /^View invoice/ })).toHaveLength(2);
    });

    it("opens the invoice when the eye is clicked", async () => {
        vi.mocked(getInvoices).mockResolvedValue(wireInvoiceSummaries());
        const user = userEvent.setup();
        renderWithProviders(
            <Routes>
                <Route path="/" element={<InvoicesPage />} />
                <Route path="/invoices/:id" element={<p>Invoice opened</p>} />
            </Routes>
        );

        await user.click(await screen.findByRole("link", { name: "View invoice 1" }));
        expect(await screen.findByText("Invoice opened")).toBeInTheDocument();
    });

    it("links each invoice to its page and has a New invoice button", async () => {
        vi.mocked(getInvoices).mockResolvedValue(wireInvoiceSummaries());
        renderWithProviders(<InvoicesPage />);

        expect(await screen.findByRole("link", { name: "Invoice 2" })).toHaveAttribute(
            "href",
            "/invoices/2"
        );
        expect(screen.getByRole("button", { name: "New invoice" })).toBeInTheDocument();
    });

    it("says so when there are no invoices", async () => {
        vi.mocked(getInvoices).mockResolvedValue([]);
        renderWithProviders(<InvoicesPage />);
        expect(await screen.findByText(/No invoices yet/)).toBeInTheDocument();
    });

    it("shows an error in the table when the list cannot be loaded", async () => {
        vi.mocked(getInvoices).mockRejectedValue(new Error("boom"));
        renderWithProviders(<InvoicesPage />);
        expect(
            await screen.findByText("Something went wrong. Try again.")
        ).toBeInTheDocument();
    });

    describe("new invoice modal", () => {
        const renderPage = () =>
            renderWithProviders(
                <Routes>
                    <Route path="/invoices" element={<InvoicesPage />} />
                    <Route path="/invoices/:id" element={<p>Invoice opened</p>} />
                </Routes>,
                "/invoices"
            );

        it("is closed until New invoice is pressed, then shows the form in a modal", async () => {
            vi.mocked(getInvoices).mockResolvedValue([]);
            const user = userEvent.setup();
            renderPage();

            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            await user.click(await screen.findByRole("button", { name: "New invoice" }));

            const dialog = await screen.findByRole("dialog", { name: "New invoice" });
            expect(within(dialog).getByLabelText("Face value (₦)")).toBeInTheDocument();
            expect(within(dialog).getByLabelText("Funding date")).toBeInTheDocument();
        });

        it("closes with Escape and with the close button", async () => {
            vi.mocked(getInvoices).mockResolvedValue([]);
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "New invoice" }));
            await screen.findByRole("dialog");
            await user.keyboard("{Escape}");
            await waitFor(() =>
                expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
            );

            await user.click(screen.getByRole("button", { name: "New invoice" }));
            await user.click(await screen.findByRole("button", { name: "Close" }));
            await waitFor(() =>
                expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
            );
        });

        it("takes an invoice from quote to funding inside the modal and opens it", async () => {
            vi.mocked(getInvoices).mockResolvedValue([]);
            vi.mocked(quoteInvoice).mockResolvedValue(wireInvoiceQuote(undefined, "9"));
            vi.mocked(createInvoice).mockResolvedValue(wireInvoice());
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "New invoice" }));
            await user.type(await screen.findByLabelText("Face value (₦)"), "1000000.00");
            await chooseOption(user, "Tenor (days)", "60");
            await pickDate(user, "Funding date", "2024-12-31");
            await user.click(screen.getByRole("button", { name: "Get quote" }));

            expect(
                await screen.findByText("Server quote (official)")
            ).toBeInTheDocument();
            await user.click(screen.getByRole("button", { name: "Fund invoice" }));

            expect(await screen.findByText("Invoice opened")).toBeInTheDocument();
            expect(vi.mocked(createInvoice).mock.calls[0]?.[0]).toEqual({
                quoteId: "9",
                key: expect.any(String),
            });
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });
});
