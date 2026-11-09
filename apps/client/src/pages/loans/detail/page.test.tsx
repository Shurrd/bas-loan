import { AxiosError, type AxiosResponse } from "axios";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmPayment, getLoan, previewPayment } from "@/services/func";
import QueryKeys from "@/services/query-keys";
import { wireLoan, wireStatement } from "@/test/fixtures";
import { pickDate } from "@/test/pick";
import { renderWithProviders } from "@/test/render";
import LoanDetailPage from "./page";

vi.mock("@/services/func");

const render = (route = "/loans/1") =>
    renderWithProviders(
        <Routes>
            <Route path="/loans/:id" element={<LoanDetailPage />} />
        </Routes>,
        route
    );

describe("LoanDetailPage", () => {
    beforeEach(() => vi.resetAllMocks());

    it("shows the schedule with its paid state and the posted disbursement entry", async () => {
        vi.mocked(getLoan).mockResolvedValue(
            wireLoan([
                { interestPaid: "1800000", principalPaid: "19263026" },
                { interestPaid: "500" },
            ])
        );
        render();

        expect(
            await screen.findByRole("heading", { name: "Loan 1" })
        ).toBeInTheDocument();
        expect(getLoan).toHaveBeenCalledWith("1");

        const loansRow = screen.getByRole("row", { name: /Loans Receivable/ });
        const cells = within(loansRow).getAllByRole("cell");
        expect(cells.at(-2)).toHaveTextContent("₦1,200,000.00");
        expect(cells.at(-1)).toBeEmptyDOMElement();

        const cashRow = screen.getByRole("row", { name: /Cash/ });
        const cashCells = within(cashRow).getAllByRole("cell");
        expect(cashCells.at(-2)).toBeEmptyDOMElement();
        expect(cashCells.at(-1)).toHaveTextContent("₦1,200,000.00");

        expect(screen.getByRole("row", { name: /^1 2025-02-15/ })).toHaveTextContent(
            "Paid"
        );
        expect(screen.getByRole("row", { name: /^2 2025-03-15/ })).toHaveTextContent(
            "Part paid"
        );
        expect(screen.getByRole("row", { name: /^3 2025-04-15/ })).toHaveTextContent(
            "Unpaid"
        );
    });

    it("shows an error when the loan cannot be loaded", async () => {
        vi.mocked(getLoan).mockRejectedValue(new Error("boom"));
        render("/loans/9");
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Something went wrong"
        );
    });

    it("refreshes the schedule and journal from the server after a payment is confirmed", async () => {
        const updated = wireLoan([{ interestPaid: "500000" }]);
        updated.entries.push({
            id: "2",
            kind: "payment",
            entryDate: "2025-02-15",
            reversesEntryId: null,
            lines: [
                { account: "CASH", accountName: "Cash", side: "debit", amount: "500000" },
                {
                    account: "INTEREST_INCOME",
                    accountName: "Interest Income",
                    side: "credit",
                    amount: "500000",
                },
            ],
        });
        vi.mocked(getLoan).mockResolvedValueOnce(wireLoan()).mockResolvedValue(updated);
        vi.mocked(previewPayment).mockResolvedValue({
            stateVersion: "1",
            allocation: {
                received: "500000",
                lines: [
                    {
                        number: 1,
                        penalty: "0",
                        fee: "0",
                        interest: "500000",
                        principal: "0",
                    },
                ],
                penalty: "0",
                fee: "0",
                interest: "500000",
                principal: "0",
                unapplied: "0",
            },
        });
        vi.mocked(confirmPayment).mockResolvedValue({
            stateVersion: "2",
            allocation: {
                received: "500000",
                lines: [],
                penalty: "0",
                fee: "0",
                interest: "500000",
                principal: "0",
                unapplied: "0",
            },
            entry: {
                id: "2",
                kind: "payment",
                entryDate: "2025-02-15",
                reversesEntryId: null,
                lines: [],
            },
        });

        const user = userEvent.setup();
        render();
        await screen.findByRole("heading", { name: "Loan 1" });
        expect(screen.getByRole("row", { name: /^1 2025-02-15/ })).toHaveTextContent(
            "Unpaid"
        );

        await user.type(screen.getByLabelText("Amount (₦)"), "5000.00");
        fireEvent.change(screen.getByLabelText("Payment date"), {
            target: { value: "2025-02-15" },
        });
        await user.click(screen.getByRole("button", { name: "Preview allocation" }));
        await user.click(await screen.findByRole("button", { name: "Confirm payment" }));

        await waitFor(() =>
            expect(screen.getByRole("row", { name: /^1 2025-02-15/ })).toHaveTextContent(
                "Part paid"
            )
        );
        expect(getLoan).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("row", { name: /Interest Income/ })).toHaveTextContent(
            "₦5,000.00"
        );
    });

    it("links to the statement for the loan", async () => {
        vi.mocked(getLoan).mockResolvedValue(wireLoan());
        render();

        expect(
            await screen.findByRole("link", { name: "View statement" })
        ).toHaveAttribute("href", "/loans/1/statement");
    });

    it("marks the statement stale so it refetches from the server after a confirmed payment", async () => {
        vi.mocked(getLoan).mockResolvedValue(wireLoan());
        vi.mocked(previewPayment).mockResolvedValue({
            stateVersion: "1",
            allocation: {
                received: "500000",
                lines: [],
                penalty: "0",
                fee: "0",
                interest: "500000",
                principal: "0",
                unapplied: "0",
            },
        });
        vi.mocked(confirmPayment).mockResolvedValue({
            stateVersion: "2",
            allocation: {
                received: "500000",
                lines: [],
                penalty: "0",
                fee: "0",
                interest: "500000",
                principal: "0",
                unapplied: "0",
            },
            entry: {
                id: "2",
                kind: "payment",
                entryDate: "2025-02-15",
                reversesEntryId: null,
                lines: [],
            },
        });

        const user = userEvent.setup();
        const { client } = render();
        client.setQueryData([QueryKeys.STATEMENT, "1"], wireStatement());
        client.setQueryData([QueryKeys.STATEMENT, "2"], wireStatement());
        await screen.findByRole("heading", { name: "Loan 1" });
        expect(client.getQueryState([QueryKeys.STATEMENT, "1"])?.isInvalidated).toBe(
            false
        );

        await user.type(screen.getByLabelText("Amount (₦)"), "5000.00");
        await pickDate(user, "Payment date", "2025-02-15");
        await user.click(screen.getByRole("button", { name: "Preview allocation" }));
        await user.click(await screen.findByRole("button", { name: "Confirm payment" }));

        await waitFor(() =>
            expect(client.getQueryState([QueryKeys.STATEMENT, "1"])?.isInvalidated).toBe(
                true
            )
        );
        expect(client.getQueryState([QueryKeys.STATEMENT, "2"])?.isInvalidated).toBe(
            false
        );
    });

    it("toasts and says so on the page when the server is down on load", async () => {
        vi.mocked(getLoan).mockRejectedValue(
            new AxiosError("Request failed", "ERR", undefined, undefined, {
                status: 502,
                data: "",
            } as AxiosResponse)
        );
        render();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "The server isn't responding (502)"
        );
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("(502)"), {
            id: "server-problem",
        });
    });
});
