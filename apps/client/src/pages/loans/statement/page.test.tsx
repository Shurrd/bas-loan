import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { toast } from "sonner";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveBlob } from "@/lib/download";
import { downloadStatementPdf, getStatement } from "@/services/func";
import { wireMismatchedStatement, wireStatement } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import StatementPage from "./page";

vi.mock("@/services/func");
vi.mock("@/lib/download", () => ({
    saveBlob: vi.fn(),
    fileNameFromDisposition: vi.fn(),
}));

const render = () =>
    renderWithProviders(
        <Routes>
            <Route path="/loans/:id/statement" element={<StatementPage />} />
        </Routes>,
        "/loans/1/statement"
    );

const cellsOf = (row: HTMLElement) =>
    within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent);

describe("StatementPage", () => {
    beforeEach(() => vi.resetAllMocks());

    it("shows the ledger lines with debit, credit and a running principal balance", async () => {
        vi.mocked(getStatement).mockResolvedValue(wireStatement());
        render();

        expect(await screen.findByText("Closing principal balance")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: "Statement for loan 1" })
        ).toBeInTheDocument();
        expect(getStatement).toHaveBeenCalledWith("1");

        expect(
            cellsOf(
                screen.getByRole("row", { name: /Loan disbursement Loans Receivable/ })
            )
        ).toEqual([
            "2025-01-15",
            "Loan disbursement",
            "Loans Receivable",
            "₦1,200,000.00",
            "",
            "₦1,200,000.00",
        ]);
        expect(
            cellsOf(
                screen.getByRole("row", { name: /Payment received Loans Receivable/ })
            )
        ).toEqual([
            "2025-02-15",
            "Payment received",
            "Loans Receivable",
            "",
            "₦192,630.26",
            "₦1,007,369.74",
        ]);
    });

    it("keeps interest and Unapplied Credit lines from changing the running balance", async () => {
        vi.mocked(getStatement).mockResolvedValue(wireStatement());
        render();
        await screen.findByText("Closing principal balance");

        for (const account of ["Interest Income", "Unapplied Credit"]) {
            const cells = cellsOf(
                screen.getByRole("row", {
                    name: new RegExp(`Payment received\ ${account}`),
                })
            );
            expect(cells.at(-1)).toBe("₦1,007,369.74");
        }
        const cash = cellsOf(screen.getByRole("row", { name: /Payment received Cash/ }));
        expect(cash.at(-1)).toBe("₦1,200,000.00");
        expect(
            screen.getByRole("row", { name: /Closing principal balance/ })
        ).toHaveTextContent("₦1,007,369.74");
    });

    it("shows a clear match state when the statement and the schedule agree", async () => {
        vi.mocked(getStatement).mockResolvedValue(wireStatement());
        render();

        const status = await screen.findByRole("status");
        expect(status).toHaveTextContent("Tie-out matches");
        expect(status).toHaveTextContent("₦1,007,369.74");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("goes red with the difference in kobo and naira when they disagree", async () => {
        vi.mocked(getStatement).mockResolvedValue(wireMismatchedStatement());
        render();

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Tie-out failed");
        expect(alert).toHaveTextContent("Statement closing balance: ₦1,200,000.00");
        expect(alert).toHaveTextContent("Schedule outstanding principal: ₦1,007,369.74");
        expect(alert).toHaveTextContent("Difference: 19,263,026 kobo (₦192,630.26)");
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(
            screen.getByRole("row", { name: /Reversal of entry 2/ })
        ).toBeInTheDocument();
    });

    it("shows a difference in either direction with its sign", async () => {
        const statement = wireStatement();
        statement.tieOut = {
            outstandingPrincipal: "100737974",
            difference: "-1000",
            matches: false,
        };
        vi.mocked(getStatement).mockResolvedValue(statement);
        render();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Difference: -1,000 kobo (-₦10.00)"
        );
    });

    it("shows an error when the statement cannot be loaded", async () => {
        vi.mocked(getStatement).mockRejectedValue(new Error("boom"));
        render();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Something went wrong"
        );
    });

    describe("Download PDF", () => {
        const failure = (status: number) =>
            new AxiosError("Request failed", "ERR", undefined, undefined, {
                status,
                data: "",
            } as AxiosResponse);

        it("fetches the PDF from the server and saves it under the name the server gave", async () => {
            vi.mocked(getStatement).mockResolvedValue(wireStatement());
            const blob = new Blob(["%PDF-"], { type: "application/pdf" });
            vi.mocked(downloadStatementPdf).mockResolvedValue({
                blob,
                fileName: "loan-1-statement.pdf",
            });
            const user = userEvent.setup();
            render();

            await screen.findByText("Closing principal balance");
            await user.click(screen.getByRole("button", { name: "Download PDF" }));

            await waitFor(() =>
                expect(saveBlob).toHaveBeenCalledWith(blob, "loan-1-statement.pdf")
            );
            expect(downloadStatementPdf).toHaveBeenCalledWith("1");
            expect(toast.error).not.toHaveBeenCalled();
        });

        it("is not available until the statement has loaded", async () => {
            vi.mocked(getStatement).mockReturnValue(new Promise(() => {}));
            render();
            expect(screen.getByRole("button", { name: "Download PDF" })).toBeDisabled();
        });

        it("shows it is working and asks for the PDF only once on a double click", async () => {
            vi.mocked(getStatement).mockResolvedValue(wireStatement());
            let finish: (value: { blob: Blob; fileName: string }) => void = () => {};
            vi.mocked(downloadStatementPdf).mockReturnValue(
                new Promise((resolve) => (finish = resolve))
            );
            const user = userEvent.setup();
            render();

            await screen.findByText("Closing principal balance");
            await user.dblClick(screen.getByRole("button", { name: "Download PDF" }));

            expect(
                await screen.findByRole("button", { name: /Preparing PDF/ })
            ).toBeDisabled();
            expect(downloadStatementPdf).toHaveBeenCalledTimes(1);
            finish({ blob: new Blob(), fileName: "loan-1-statement.pdf" });
            expect(
                await screen.findByRole("button", { name: "Download PDF" })
            ).toBeEnabled();
        });

        it("tells the officer when the PDF could not be made", async () => {
            vi.mocked(getStatement).mockResolvedValue(wireStatement());
            vi.mocked(downloadStatementPdf).mockRejectedValue(failure(404));
            const user = userEvent.setup();
            render();

            await screen.findByText("Closing principal balance");
            await user.click(screen.getByRole("button", { name: "Download PDF" }));

            await waitFor(() =>
                expect(toast.error).toHaveBeenCalledWith(
                    "Couldn't prepare the PDF. Try again."
                )
            );
            expect(saveBlob).not.toHaveBeenCalled();
        });

        it("shows the server-down toast once, not a second one, when the server is down", async () => {
            vi.mocked(getStatement).mockResolvedValue(wireStatement());
            vi.mocked(downloadStatementPdf).mockRejectedValue(failure(502));
            const user = userEvent.setup();
            render();

            await screen.findByText("Closing principal balance");
            await user.click(screen.getByRole("button", { name: "Download PDF" }));

            await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
            expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("(502)"), {
                id: "server-problem",
            });
        });
    });
});
