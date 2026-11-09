import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLoan, quoteLoan } from "@/services/func";
import { wireLoan, wireQuote } from "@/test/fixtures";
import { chooseOption, pickDate } from "@/test/pick";
import { renderWithProviders } from "@/test/render";
import type { LoanDetailResponse } from "@/types/api";
import LoanForm from "./loan-form";

vi.mock("@/services/func");

const failure = (status: number, data: unknown) =>
    new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status,
        data,
    } as AxiosResponse);

const render = () =>
    renderWithProviders(
        <Routes>
            <Route path="/" element={<LoanForm />} />
            <Route path="/loans/:id" element={<p>Loan opened</p>} />
        </Routes>
    );

const field = (label: string) => screen.getByLabelText(label);

const fill = async (
    user: ReturnType<typeof userEvent.setup>,
    principal = "1200000.00"
) => {
    await user.type(field("Principal (₦)"), principal);
    await user.type(field("Annual rate (%)"), "18");
    await chooseOption(user, "Term (months)", "6");
    await pickDate(user, "Disbursement date", "2025-01-15");
};

const getQuote = async (user: ReturnType<typeof userEvent.setup>) => {
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Get quote" }));
    await screen.findByRole("button", { name: "Approve and disburse" });
};

const keyOfCall = (index: number) => vi.mocked(createLoan).mock.calls[index]?.[0].key;

describe("LoanForm", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(quoteLoan).mockResolvedValue(wireQuote());
    });

    it("sends kobo as a string and shows the server quote as the official one", async () => {
        render();
        await getQuote(userEvent.setup());

        expect(vi.mocked(quoteLoan).mock.calls[0]?.[0]).toEqual({
            principal: "120000000",
            annualRatePercent: "18",
            termMonths: 6,
            disbursementDate: "2025-01-15",
        });
        expect(screen.getByText("Server quote (official)")).toBeInTheDocument();
        expect(screen.getAllByText("₦210,630.26", { selector: "td" })).toHaveLength(5);
    });

    it("shows nothing extra and allows approval when the server quote agrees to the kobo", async () => {
        render();
        await getQuote(userEvent.setup());

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByText(/matches the server quote/)).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Approve and disburse" })
        ).toBeEnabled();
    });

    it("shows a clear error and blocks approval when the server quote differs by one kobo", async () => {
        const quote = wireQuote();
        quote.schedule[2]!.interest = "1217776";
        vi.mocked(quoteLoan).mockResolvedValue(quote);
        const user = userEvent.setup();
        render();
        await getQuote(user);

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("does not match the server quote");
        expect(alert).toHaveTextContent(
            "Instalment 3, interest: preview 1217775, server 1217776"
        );
        expect(
            screen.getByRole("button", { name: "Approve and disburse" })
        ).toBeDisabled();
        expect(screen.getByText("Server quote (official)")).toBeInTheDocument();
        expect(screen.getByText("₦12,177.76", { selector: "td" })).toBeInTheDocument();
    });

    it("shows a server validation error against the field it names", async () => {
        vi.mocked(quoteLoan).mockRejectedValue(
            failure(400, {
                errors: [
                    {
                        field: "annualRatePercent",
                        message: "Rate cannot be more than 100",
                    },
                ],
            })
        );
        const user = userEvent.setup();
        render();
        await fill(user);
        await user.click(screen.getByRole("button", { name: "Get quote" }));

        await waitFor(() =>
            expect(field("Annual rate (%)")).toHaveAccessibleDescription(
                "Rate cannot be more than 100"
            )
        );
        expect(field("Annual rate (%)")).toBeInvalid();
        for (const other of ["Principal (₦)", "Disbursement date"]) {
            expect(field(other)).toBeValid();
        }
    });

    it("puts several server errors on their own fields", async () => {
        vi.mocked(quoteLoan).mockRejectedValue(
            failure(400, {
                errors: [
                    { field: "principal", message: "Principal is too large" },
                    { field: "termMonths", message: "Term is too long" },
                ],
            })
        );
        const user = userEvent.setup();
        render();
        await fill(user);
        await user.click(screen.getByRole("button", { name: "Get quote" }));

        await waitFor(() =>
            expect(field("Principal (₦)")).toHaveAccessibleDescription(
                "Principal is too large"
            )
        );
        expect(
            screen.getByRole("group", { name: "Term (months)" })
        ).toHaveAccessibleDescription("Term is too long");
        expect(field("Annual rate (%)")).toBeValid();
    });

    it("rejects 3 decimal places on the client without calling the API", async () => {
        const user = userEvent.setup();
        render();
        await fill(user, "1000.505");
        await user.click(screen.getByRole("button", { name: "Get quote" }));

        expect(field("Principal (₦)")).toHaveAccessibleDescription(
            "Naira amounts can have at most 2 decimal places"
        );
        expect(quoteLoan).not.toHaveBeenCalled();
    });

    it("approves the saved quote by its id, not by the terms on screen", async () => {
        vi.mocked(quoteLoan).mockResolvedValue(wireQuote(undefined, "42"));
        vi.mocked(createLoan).mockResolvedValue(wireLoan());
        const user = userEvent.setup();
        render();
        await getQuote(user);
        await user.click(screen.getByRole("button", { name: "Approve and disburse" }));

        await screen.findByText("Loan opened");
        expect(vi.mocked(createLoan).mock.calls[0]?.[0]).toEqual({
            quoteId: "42",
            key: expect.any(String),
        });
    });

    it("disburses once when Approve is clicked twice", async () => {
        let finish: (detail: LoanDetailResponse) => void = () => {};
        vi.mocked(createLoan).mockReturnValue(
            new Promise((resolve) => (finish = resolve))
        );
        const user = userEvent.setup();
        render();
        await getQuote(user);

        const approve = screen.getByRole("button", { name: "Approve and disburse" });
        fireEvent.click(approve);
        fireEvent.click(approve);

        await waitFor(() => expect(createLoan).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(createLoan).toHaveBeenCalledTimes(1);
        finish(wireLoan());
        expect(await screen.findByText("Loan opened")).toBeInTheDocument();
        expect(createLoan).toHaveBeenCalledTimes(1);
    });

    it("reuses the same idempotency key when the officer retries after a failure", async () => {
        vi.mocked(createLoan)
            .mockRejectedValueOnce(new AxiosError("Network Error"))
            .mockResolvedValueOnce(wireLoan());
        const user = userEvent.setup();
        render();
        await getQuote(user);

        await user.click(screen.getByRole("button", { name: "Approve and disburse" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        await user.click(screen.getByRole("button", { name: "Approve and disburse" }));
        await screen.findByText("Loan opened");

        expect(createLoan).toHaveBeenCalledTimes(2);
        expect(keyOfCall(0)).toBeTruthy();
        expect(keyOfCall(1)).toBe(keyOfCall(0));
    });

    it("hides the approval and uses a new key once the form is edited and quoted again", async () => {
        vi.mocked(quoteLoan).mockImplementation(async (request) => wireQuote(request));
        vi.mocked(createLoan).mockRejectedValue(new AxiosError("Network Error"));
        const user = userEvent.setup();
        render();
        await getQuote(user);
        await user.click(screen.getByRole("button", { name: "Approve and disburse" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalled());

        await chooseOption(user, "Term (months)", "60");
        expect(
            screen.queryByRole("button", { name: "Approve and disburse" })
        ).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Get quote" }));
        await user.click(
            await screen.findByRole("button", { name: "Approve and disburse" })
        );
        await waitFor(() => expect(createLoan).toHaveBeenCalledTimes(2));
        expect(keyOfCall(1)).not.toBe(keyOfCall(0));
    });

    it("links to the existing loan when the quote was already approved", async () => {
        vi.mocked(createLoan).mockRejectedValue(
            failure(409, { message: "This quote has already been approved", loanId: "3" })
        );
        const user = userEvent.setup();
        render();
        await getQuote(user);
        await user.click(screen.getByRole("button", { name: "Approve and disburse" }));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("This quote has already been approved");
        expect(screen.getByRole("link", { name: "Open loan 3" })).toHaveAttribute(
            "href",
            "/loans/3"
        );
    });

    it("shows a toast, not a message in the form, when the server is down", async () => {
        vi.mocked(createLoan).mockRejectedValue(failure(502, "<html>Bad Gateway</html>"));
        const user = userEvent.setup();
        render();
        await getQuote(user);
        await user.click(screen.getByRole("button", { name: "Approve and disburse" }));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "The server isn't responding (502). Check that the API is running and try again.",
                { id: "server-problem" }
            )
        );
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows a toast when the quote request cannot reach the server", async () => {
        vi.mocked(quoteLoan).mockRejectedValue(new AxiosError("Network Error"));
        const user = userEvent.setup();
        render();
        await fill(user);
        await user.click(screen.getByRole("button", { name: "Get quote" }));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                expect.stringMatching(/Can't reach the server/),
                {
                    id: "server-problem",
                }
            )
        );
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("keeps a rejected request in the form and out of the toasts", async () => {
        vi.mocked(createLoan).mockRejectedValue(
            failure(409, { message: "This quote has already been approved", loanId: "3" })
        );
        const user = userEvent.setup();
        render();
        await getQuote(user);
        await user.click(screen.getByRole("button", { name: "Approve and disburse" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "already been approved"
        );
        expect(toast.error).not.toHaveBeenCalled();
    });

    it("formats the principal with commas as it is typed and sends plain kobo", async () => {
        const user = userEvent.setup();
        render();
        await user.type(field("Principal (₦)"), "1200000.5");
        expect(field("Principal (₦)")).toHaveValue("1,200,000.5");

        await chooseOption(user, "Term (months)", "6");
        await pickDate(user, "Disbursement date", "2025-01-15");
        await user.type(field("Annual rate (%)"), "18");
        await user.click(screen.getByRole("button", { name: "Get quote" }));

        await waitFor(() => expect(quoteLoan).toHaveBeenCalled());
        expect(vi.mocked(quoteLoan).mock.calls[0]?.[0].principal).toBe("120000050");
    });
});
