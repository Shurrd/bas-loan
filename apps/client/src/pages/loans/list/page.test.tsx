import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLoan, getLoans, quoteLoan } from "@/services/func";
import { wireLoan, wireLoanSummaries, wireQuote } from "@/test/fixtures";
import { chooseOption, pickDate } from "@/test/pick";
import { renderWithProviders } from "@/test/render";
import LoansPage from "./page";

vi.mock("@/services/func");

const cellsOf = (row: HTMLElement) =>
    within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent);

describe("LoansPage", () => {
    beforeEach(() => vi.resetAllMocks());

    it("lists each loan with its terms, outstanding principal and status", async () => {
        vi.mocked(getLoans).mockResolvedValue(wireLoanSummaries());
        renderWithProviders(<LoansPage />);

        const repaid = await screen.findByRole("row", { name: /Loan 2/ });
        expect(cellsOf(repaid)).toEqual([
            "Loan 2",
            "2025-03-01",
            "₦50,000.00",
            "24.5%",
            "3 months",
            "₦0.00",
            "Repaid",
        ]);
        expect(cellsOf(screen.getByRole("row", { name: /Loan 1/ }))).toEqual([
            "Loan 1",
            "2025-01-15",
            "₦1,200,000.00",
            "18%",
            "6 months",
            "₦1,007,369.74",
            "Active",
        ]);
    });

    it("keeps the order the server sends, newest first", async () => {
        vi.mocked(getLoans).mockResolvedValue(wireLoanSummaries());
        renderWithProviders(<LoansPage />);

        await screen.findByRole("row", { name: /Loan 2/ });
        const links = screen
            .getAllByRole("link", { name: /^Loan \d/ })
            .map((link) => link.textContent);
        expect(links).toEqual(["Loan 2", "Loan 1"]);
    });

    it("links each loan to its page and has a New loan button", async () => {
        vi.mocked(getLoans).mockResolvedValue(wireLoanSummaries());
        renderWithProviders(<LoansPage />);

        expect(await screen.findByRole("link", { name: "Loan 1" })).toHaveAttribute(
            "href",
            "/loans/1"
        );
        expect(screen.getByRole("button", { name: "New loan" })).toBeInTheDocument();
    });

    it("says so when there are no loans, and still offers New loan", async () => {
        vi.mocked(getLoans).mockResolvedValue([]);
        renderWithProviders(<LoansPage />);

        expect(await screen.findByText(/No loans yet/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "New loan" })).toBeInTheDocument();
    });

    it("shows an error in the table when the list cannot be loaded", async () => {
        vi.mocked(getLoans).mockRejectedValue(new Error("boom"));
        renderWithProviders(<LoansPage />);

        expect(
            await screen.findByText("Something went wrong. Try again.")
        ).toBeInTheDocument();
    });

    describe("new loan modal", () => {
        const renderPage = () =>
            renderWithProviders(
                <Routes>
                    <Route path="/loans" element={<LoansPage />} />
                    <Route path="/loans/:id" element={<p>Loan opened</p>} />
                </Routes>,
                "/loans"
            );

        it("is closed until New loan is pressed, then shows the form in a modal", async () => {
            vi.mocked(getLoans).mockResolvedValue([]);
            const user = userEvent.setup();
            renderPage();

            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            await user.click(await screen.findByRole("button", { name: "New loan" }));

            const dialog = await screen.findByRole("dialog", { name: "New term loan" });
            expect(within(dialog).getByLabelText("Principal (₦)")).toBeInTheDocument();
            expect(within(dialog).getByLabelText("Annual rate (%)")).toBeInTheDocument();
            expect(
                within(dialog).getByLabelText("Disbursement date")
            ).toBeInTheDocument();
            expect(
                within(dialog).getByRole("button", { name: "Get quote" })
            ).toBeInTheDocument();
        });

        it("closes with Escape and with the close button, and starts empty when reopened", async () => {
            vi.mocked(getLoans).mockResolvedValue([]);
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "New loan" }));
            await user.type(await screen.findByLabelText("Principal (₦)"), "5000");
            await user.keyboard("{Escape}");
            await waitFor(() =>
                expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
            );

            await user.click(screen.getByRole("button", { name: "New loan" }));
            expect(await screen.findByLabelText("Principal (₦)")).toHaveValue("");

            await user.click(screen.getByRole("button", { name: "Close" }));
            await waitFor(() =>
                expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
            );
        });

        it("lets the officer click a dropdown option inside the modal", async () => {
            vi.mocked(getLoans).mockResolvedValue([]);
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "New loan" }));
            await user.click(
                await screen.findByRole("combobox", { name: "Term (months)" })
            );
            await user.click(await screen.findByText("12 months"));

            expect(screen.getByText("12 months")).toBeInTheDocument();
            expect(screen.queryByText("18 months")).not.toBeInTheDocument();
        });

        it("takes a loan from quote to approval inside the modal and opens the loan", async () => {
            vi.mocked(getLoans).mockResolvedValue([]);
            vi.mocked(quoteLoan).mockResolvedValue(wireQuote(undefined, "7"));
            vi.mocked(createLoan).mockResolvedValue(wireLoan());
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "New loan" }));
            await user.type(await screen.findByLabelText("Principal (₦)"), "1200000.00");
            await user.type(screen.getByLabelText("Annual rate (%)"), "18");
            await chooseOption(user, "Term (months)", "6");
            await pickDate(user, "Disbursement date", "2025-01-15");
            await user.click(screen.getByRole("button", { name: "Get quote" }));

            expect(
                await screen.findByText("Server quote (official)")
            ).toBeInTheDocument();
            expect(vi.mocked(quoteLoan).mock.calls[0]?.[0]).toEqual({
                principal: "120000000",
                annualRatePercent: "18",
                termMonths: 6,
                disbursementDate: "2025-01-15",
            });

            await user.click(
                screen.getByRole("button", { name: "Approve and disburse" })
            );
            expect(await screen.findByText("Loan opened")).toBeInTheDocument();
            expect(vi.mocked(createLoan).mock.calls[0]?.[0]).toEqual({
                quoteId: "7",
                key: expect.any(String),
            });
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });
});
