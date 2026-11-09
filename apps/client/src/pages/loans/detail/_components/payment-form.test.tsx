import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmPayment, previewPayment } from "@/services/func";
import { termsRequest } from "@/test/fixtures";
import { pickDate } from "@/test/pick";
import { renderWithProviders } from "@/test/render";
import type { PaymentPreviewResponse, PaymentResultResponse } from "@/types/api";
import PaymentForm from "./payment-form";

vi.mock("@/services/func");

const loan = { id: "1", ...termsRequest };

const allocation: PaymentPreviewResponse["allocation"] = {
    received: "30000000",
    lines: [
        { number: 1, penalty: "0", fee: "0", interest: "1800000", principal: "19263026" },
    ],
    penalty: "0",
    fee: "0",
    interest: "1800000",
    principal: "19263026",
    unapplied: "8936974",
};

const previewed: PaymentPreviewResponse = { stateVersion: "4", allocation };

const posted: PaymentResultResponse = {
    stateVersion: "5",
    allocation,
    entry: {
        id: "5",
        kind: "payment",
        entryDate: "2025-02-15",
        reversesEntryId: null,
        lines: [],
    },
};

const failure = (status: number, data: unknown) =>
    new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status,
        data,
    } as AxiosResponse);

const field = (label: string) => screen.getByLabelText(label);

const fill = async (user: ReturnType<typeof userEvent.setup>, amount = "300000.00") => {
    await user.type(field("Amount (₦)"), amount);
    await pickDate(user, "Payment date", "2025-02-15");
};

const getPreview = async (user: ReturnType<typeof userEvent.setup>) => {
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Preview allocation" }));
    await screen.findByRole("button", { name: "Confirm payment" });
};

const keyOfCall = (index: number) => vi.mocked(confirmPayment).mock.calls[index]?.[0].key;

describe("PaymentForm", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(previewPayment).mockResolvedValue(previewed);
    });

    it("sends kobo as a string and shows the allocation the server worked out", async () => {
        renderWithProviders(<PaymentForm loan={loan} />);
        await getPreview(userEvent.setup());

        expect(vi.mocked(previewPayment).mock.calls[0]?.[0]).toEqual({
            loanId: "1",
            body: { amount: "30000000", paymentDate: "2025-02-15" },
        });
        expect(screen.getByText("Instalment 1")).toBeInTheDocument();
        expect(screen.getByRole("row", { name: /Unapplied credit/ })).toHaveTextContent(
            "₦89,369.74"
        );
        expect(screen.getByRole("row", { name: /Total applied/ })).toHaveTextContent(
            "₦192,630.26"
        );
    });

    it("confirms with the state version it previewed and refreshes nothing it computed itself", async () => {
        vi.mocked(confirmPayment).mockResolvedValue(posted);
        const user = userEvent.setup();
        renderWithProviders(<PaymentForm loan={loan} />);
        await getPreview(user);
        await user.click(screen.getByRole("button", { name: "Confirm payment" }));

        expect(await screen.findByRole("status")).toHaveTextContent(
            "Payment of ₦300,000.00 posted as entry 5"
        );
        expect(vi.mocked(confirmPayment).mock.calls[0]?.[0]).toEqual({
            loanId: "1",
            body: { amount: "30000000", paymentDate: "2025-02-15", stateVersion: "4" },
            key: expect.any(String),
        });
        expect(
            screen.queryByRole("button", { name: "Confirm payment" })
        ).not.toBeInTheDocument();
        expect(field("Amount (₦)")).toHaveValue("");
    });

    it("posts once when Confirm is clicked twice", async () => {
        let finish: (result: PaymentResultResponse) => void = () => {};
        vi.mocked(confirmPayment).mockReturnValue(
            new Promise((resolve) => (finish = resolve))
        );
        const user = userEvent.setup();
        renderWithProviders(<PaymentForm loan={loan} />);
        await getPreview(user);

        const confirm = screen.getByRole("button", { name: "Confirm payment" });
        fireEvent.click(confirm);
        fireEvent.click(confirm);

        await waitFor(() => expect(confirmPayment).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(confirmPayment).toHaveBeenCalledTimes(1);
        finish(posted);
        await screen.findByRole("status");
        expect(confirmPayment).toHaveBeenCalledTimes(1);
    });

    it("reuses the idempotency key on retry and starts a new one after an edit", async () => {
        vi.mocked(confirmPayment)
            .mockRejectedValueOnce(new AxiosError("Network Error"))
            .mockRejectedValueOnce(new AxiosError("Network Error"))
            .mockResolvedValueOnce(posted);
        const user = userEvent.setup();
        renderWithProviders(<PaymentForm loan={loan} />);
        await getPreview(user);

        await user.click(screen.getByRole("button", { name: "Confirm payment" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        await user.click(screen.getByRole("button", { name: "Confirm payment" }));
        await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(2));
        expect(keyOfCall(1)).toBe(keyOfCall(0));

        await user.clear(field("Amount (₦)"));
        await user.type(field("Amount (₦)"), "400000.00");
        expect(
            screen.queryByRole("button", { name: "Confirm payment" })
        ).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Preview allocation" }));
        await user.click(await screen.findByRole("button", { name: "Confirm payment" }));
        await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(3));
        expect(keyOfCall(2)).not.toBe(keyOfCall(0));
    });

    it("drops the preview and says so when the loan changed since it", async () => {
        vi.mocked(confirmPayment).mockRejectedValue(
            failure(409, {
                message:
                    "This loan changed after the preview. Preview the payment again.",
                code: "STATE_CHANGED",
            })
        );
        const user = userEvent.setup();
        renderWithProviders(<PaymentForm loan={loan} />);
        await getPreview(user);
        await user.click(screen.getByRole("button", { name: "Confirm payment" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Preview the payment again"
        );
        expect(
            screen.queryByRole("button", { name: "Confirm payment" })
        ).not.toBeInTheDocument();
    });

    it("shows server validation errors against the amount and date fields", async () => {
        vi.mocked(previewPayment).mockRejectedValue(
            failure(400, {
                errors: [
                    { field: "amount", message: "Amount is too large" },
                    {
                        field: "paymentDate",
                        message:
                            "Payment date cannot be before the disbursement date (2025-01-15)",
                    },
                ],
            })
        );
        const user = userEvent.setup();
        renderWithProviders(<PaymentForm loan={loan} />);
        await fill(user);
        await user.click(screen.getByRole("button", { name: "Preview allocation" }));

        await waitFor(() =>
            expect(field("Amount (₦)")).toHaveAccessibleDescription("Amount is too large")
        );
        expect(field("Payment date")).toHaveAccessibleDescription(
            /before the disbursement date/
        );
    });

    it("rejects 3 decimal places, zero and an early date on the client without calling the API", async () => {
        const user = userEvent.setup();
        renderWithProviders(<PaymentForm loan={loan} />);

        await user.type(field("Amount (₦)"), "1000.505");
        await user.click(screen.getByRole("button", { name: "Preview allocation" }));
        expect(field("Amount (₦)")).toHaveAccessibleDescription(
            "Naira amounts can have at most 2 decimal places"
        );

        await user.clear(field("Amount (₦)"));
        await user.type(field("Amount (₦)"), "0");
        await pickDate(user, "Payment date", "2025-01-14");
        await user.click(screen.getByRole("button", { name: "Preview allocation" }));
        expect(field("Amount (₦)")).toHaveAccessibleDescription(
            "Amount must be greater than zero"
        );
        expect(field("Payment date")).toHaveAccessibleDescription(
            /before the disbursement date/
        );

        expect(previewPayment).not.toHaveBeenCalled();
    });
});
