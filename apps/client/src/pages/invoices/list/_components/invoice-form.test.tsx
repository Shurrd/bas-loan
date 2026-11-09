import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInvoice, quoteInvoice } from "@/services/func";
import { wireInvoice, wireInvoiceQuote } from "@/test/fixtures";
import { chooseOption, pickDate } from "@/test/pick";
import { renderWithProviders } from "@/test/render";
import type { InvoiceDetailResponse } from "@/types/api";
import InvoiceForm from "./invoice-form";

vi.mock("@/services/func");

const failure = (status: number, data: unknown) =>
    new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status,
        data,
    } as AxiosResponse);

const render = () =>
    renderWithProviders(
        <Routes>
            <Route path="/" element={<InvoiceForm />} />
            <Route path="/invoices/:id" element={<p>Invoice opened</p>} />
        </Routes>
    );

type User = ReturnType<typeof userEvent.setup>;

const field = (label: string) => screen.getByLabelText(label);

const fill = async (user: User, faceValue = "1000000.00") => {
    await user.type(field("Face value (₦)"), faceValue);
    await chooseOption(user, "Tenor (days)", "60");
    await pickDate(user, "Funding date", "2024-12-31");
};

const getQuote = async (user: User) => {
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Get quote" }));
    await screen.findByRole("button", { name: "Fund invoice" });
};

const keyOfCall = (index: number) => vi.mocked(createInvoice).mock.calls[index]?.[0].key;

describe("InvoiceForm", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(quoteInvoice).mockResolvedValue(wireInvoiceQuote());
    });

    it("sends kobo as a string and the tenor as a number, and shows the server quote as official", async () => {
        render();
        await getQuote(userEvent.setup());

        expect(vi.mocked(quoteInvoice).mock.calls[0]?.[0]).toEqual({
            faceValue: "100000000",
            tenorDays: 60,
            fundingDate: "2024-12-31",
        });
        expect(screen.getByText("Server quote (official)")).toBeInTheDocument();
        expect(screen.getByText("₦800,000.00")).toBeInTheDocument();
        expect(screen.getByText("₦47,342.47")).toBeInTheDocument();
        expect(screen.getByText("2025-03-01")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Fund invoice" })).toBeEnabled();
    });

    it("shows a clear error and blocks funding when the server quote differs by one kobo", async () => {
        vi.mocked(quoteInvoice).mockResolvedValue({
            ...wireInvoiceQuote(),
            fee: "4734248",
        });
        const user = userEvent.setup();
        render();
        await getQuote(user);

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("does not match the server quote");
        expect(alert).toHaveTextContent("fee: preview 4734247, server 4734248");
        expect(screen.getByRole("button", { name: "Fund invoice" })).toBeDisabled();
        expect(screen.getByText("Server quote (official)")).toBeInTheDocument();
        expect(screen.getByText("₦47,342.48")).toBeInTheDocument();
    });

    it("shows server errors against the face value, tenor and funding date fields", async () => {
        vi.mocked(quoteInvoice).mockRejectedValue(
            failure(400, {
                errors: [
                    { field: "faceValue", message: "Face value is too large" },
                    {
                        field: "tenorDays",
                        message: "Tenor must be a whole number of days from 1 to 365",
                    },
                    {
                        field: "fundingDate",
                        message: "Funding date cannot be after 2100-12-31",
                    },
                ],
            })
        );
        const user = userEvent.setup();
        render();
        await fill(user);
        await user.click(screen.getByRole("button", { name: "Get quote" }));

        await waitFor(() =>
            expect(field("Face value (₦)")).toHaveAccessibleDescription(
                "Face value is too large"
            )
        );
        expect(
            screen.getByRole("group", { name: "Tenor (days)" })
        ).toHaveAccessibleDescription(/from 1 to 365/);
        expect(field("Funding date")).toHaveAccessibleDescription(
            /cannot be after 2100-12-31/
        );
    });

    it("puts a single server error on its own field only", async () => {
        vi.mocked(quoteInvoice).mockRejectedValue(
            failure(400, {
                errors: [{ field: "faceValue", message: "Face value is too large" }],
            })
        );
        const user = userEvent.setup();
        render();
        await fill(user);
        await user.click(screen.getByRole("button", { name: "Get quote" }));

        await waitFor(() => expect(field("Face value (₦)")).toBeInvalid());
        expect(field("Funding date")).toBeValid();
        expect(
            screen.getByRole("group", { name: "Tenor (days)" })
        ).not.toHaveAccessibleDescription(/./);
    });

    it("rejects 3 decimal places and a missing tenor on the client without calling the API", async () => {
        const user = userEvent.setup();
        render();
        await user.type(field("Face value (₦)"), "1000.505");
        await pickDate(user, "Funding date", "2024-12-31");
        await user.click(screen.getByRole("button", { name: "Get quote" }));

        expect(field("Face value (₦)")).toHaveAccessibleDescription(
            "Naira amounts can have at most 2 decimal places"
        );
        expect(
            screen.getByRole("group", { name: "Tenor (days)" })
        ).toHaveAccessibleDescription(/whole number of days/);
        expect(quoteInvoice).not.toHaveBeenCalled();
    });

    it("funds the saved quote by its id, not by the terms on screen", async () => {
        vi.mocked(quoteInvoice).mockResolvedValue(wireInvoiceQuote(undefined, "42"));
        vi.mocked(createInvoice).mockResolvedValue(wireInvoice());
        const user = userEvent.setup();
        render();
        await getQuote(user);
        await user.click(screen.getByRole("button", { name: "Fund invoice" }));

        await screen.findByText("Invoice opened");
        expect(vi.mocked(createInvoice).mock.calls[0]?.[0]).toEqual({
            quoteId: "42",
            key: expect.any(String),
        });
    });

    it("funds once when Fund is clicked twice", async () => {
        let finish: (detail: InvoiceDetailResponse) => void = () => {};
        vi.mocked(createInvoice).mockReturnValue(
            new Promise((resolve) => (finish = resolve))
        );
        const user = userEvent.setup();
        render();
        await getQuote(user);

        const fund = screen.getByRole("button", { name: "Fund invoice" });
        await user.dblClick(fund);

        await waitFor(() => expect(createInvoice).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(createInvoice).toHaveBeenCalledTimes(1);
        finish(wireInvoice());
        expect(await screen.findByText("Invoice opened")).toBeInTheDocument();
        expect(createInvoice).toHaveBeenCalledTimes(1);
    });

    it("reuses the same idempotency key on retry and starts a new one after an edit", async () => {
        vi.mocked(quoteInvoice).mockImplementation(async (request) =>
            wireInvoiceQuote(request)
        );
        vi.mocked(createInvoice).mockRejectedValue(new AxiosError("Network Error"));
        const user = userEvent.setup();
        render();
        await getQuote(user);

        await user.click(screen.getByRole("button", { name: "Fund invoice" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        await user.click(screen.getByRole("button", { name: "Fund invoice" }));
        await waitFor(() => expect(createInvoice).toHaveBeenCalledTimes(2));
        expect(keyOfCall(1)).toBe(keyOfCall(0));

        await chooseOption(user, "Tenor (days)", "90");
        expect(
            screen.queryByRole("button", { name: "Fund invoice" })
        ).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Get quote" }));
        await user.click(await screen.findByRole("button", { name: "Fund invoice" }));
        await waitFor(() => expect(createInvoice).toHaveBeenCalledTimes(3));
        expect(keyOfCall(2)).not.toBe(keyOfCall(0));
    });

    it("links to the existing invoice when the quote was already funded", async () => {
        vi.mocked(createInvoice).mockRejectedValue(
            failure(409, {
                message: "This quote has already been funded",
                invoiceId: "3",
            })
        );
        const user = userEvent.setup();
        render();
        await getQuote(user);
        await user.click(screen.getByRole("button", { name: "Fund invoice" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "This quote has already been funded"
        );
        expect(screen.getByRole("link", { name: "Open invoice 3" })).toHaveAttribute(
            "href",
            "/invoices/3"
        );
    });
});
