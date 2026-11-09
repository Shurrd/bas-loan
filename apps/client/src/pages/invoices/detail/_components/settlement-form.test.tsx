import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmSettlement, previewSettlement } from "@/services/func";
import { wireInvoice, wireSettlement } from "@/test/fixtures";
import { pickDate } from "@/test/pick";
import { renderWithProviders } from "@/test/render";
import type { SettlementResultResponse } from "@/types/api";
import SettlementForm from "./settlement-form";

vi.mock("@/services/func");

const { invoice } = wireInvoice();

const result: SettlementResultResponse = {
    settlement: wireSettlement("2025-06-05"),
    entry: {
        id: "2",
        kind: "invoice_settlement",
        entryDate: "2025-06-05",
        reversesEntryId: null,
        lines: [],
    },
};

const failure = (status: number, data: unknown) =>
    new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status,
        data,
    } as AxiosResponse);

type User = ReturnType<typeof userEvent.setup>;

const getPreview = async (user: User, date = "2025-06-05") => {
    await pickDate(user, "Settlement date", date);
    await user.click(screen.getByRole("button", { name: "Preview settlement" }));
    await screen.findByRole("button", { name: "Confirm settlement" });
};

const keyOfCall = (index: number) =>
    vi.mocked(confirmSettlement).mock.calls[index]?.[0].key;

describe("SettlementForm", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(previewSettlement).mockResolvedValue({
            settlement: wireSettlement("2025-06-05"),
        });
    });

    it("asks for a date only, since the debtor always pays the face value", async () => {
        renderWithProviders(<SettlementForm invoice={invoice} />);

        expect(screen.getByLabelText("Settlement date")).toBeInTheDocument();
        expect(screen.queryByLabelText(/amount/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/payable/i)).not.toBeInTheDocument();
    });

    it("sends only the date and shows the settlement the server worked out", async () => {
        renderWithProviders(<SettlementForm invoice={invoice} />);
        await getPreview(userEvent.setup());

        expect(vi.mocked(previewSettlement).mock.calls[0]?.[0]).toEqual({
            invoiceId: "1",
            body: { settlementDate: "2025-06-05" },
        });
        expect(screen.getByText("Shortfall owed by the client")).toBeInTheDocument();
        expect(screen.getByText("₦942.47")).toBeInTheDocument();
    });

    it("confirms the previewed date with an idempotency key and no figures from the screen", async () => {
        vi.mocked(confirmSettlement).mockResolvedValue(result);
        const user = userEvent.setup();
        renderWithProviders(<SettlementForm invoice={invoice} />);
        await getPreview(user);
        await user.click(screen.getByRole("button", { name: "Confirm settlement" }));

        await waitFor(() => expect(confirmSettlement).toHaveBeenCalled());
        expect(vi.mocked(confirmSettlement).mock.calls[0]?.[0]).toEqual({
            invoiceId: "1",
            body: { settlementDate: "2025-06-05" },
            key: expect.any(String),
        });
    });

    it("posts once when Confirm is clicked twice", async () => {
        let finish: (value: SettlementResultResponse) => void = () => {};
        vi.mocked(confirmSettlement).mockReturnValue(
            new Promise((resolve) => (finish = resolve))
        );
        const user = userEvent.setup();
        renderWithProviders(<SettlementForm invoice={invoice} />);
        await getPreview(user);

        await user.dblClick(screen.getByRole("button", { name: "Confirm settlement" }));

        await waitFor(() => expect(confirmSettlement).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(confirmSettlement).toHaveBeenCalledTimes(1);
        finish(result);
    });

    it("reuses the idempotency key on retry and starts a new one after the date changes", async () => {
        vi.mocked(confirmSettlement).mockRejectedValue(new AxiosError("Network Error"));
        const user = userEvent.setup();
        renderWithProviders(<SettlementForm invoice={invoice} />);
        await getPreview(user);

        await user.click(screen.getByRole("button", { name: "Confirm settlement" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        await user.click(screen.getByRole("button", { name: "Confirm settlement" }));
        await waitFor(() => expect(confirmSettlement).toHaveBeenCalledTimes(2));
        expect(keyOfCall(1)).toBe(keyOfCall(0));

        await pickDate(user, "Settlement date", "2025-06-06");
        expect(
            screen.queryByRole("button", { name: "Confirm settlement" })
        ).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Preview settlement" }));
        await user.click(
            await screen.findByRole("button", { name: "Confirm settlement" })
        );
        await waitFor(() => expect(confirmSettlement).toHaveBeenCalledTimes(3));
        expect(keyOfCall(2)).not.toBe(keyOfCall(0));
    });

    it("drops the preview and says so when the invoice was already settled", async () => {
        vi.mocked(confirmSettlement).mockRejectedValue(
            failure(409, {
                message: "This invoice has already been settled",
                code: "ALREADY_SETTLED",
            })
        );
        const user = userEvent.setup();
        renderWithProviders(<SettlementForm invoice={invoice} />);
        await getPreview(user);
        await user.click(screen.getByRole("button", { name: "Confirm settlement" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "already been settled"
        );
        expect(
            screen.queryByRole("button", { name: "Confirm settlement" })
        ).not.toBeInTheDocument();
    });

    it("shows a server error against the settlement date field", async () => {
        vi.mocked(previewSettlement).mockRejectedValue(
            failure(400, {
                errors: [
                    {
                        field: "settlementDate",
                        message: "Settlement date cannot be after 2100-12-31",
                    },
                ],
            })
        );
        const user = userEvent.setup();
        renderWithProviders(<SettlementForm invoice={invoice} />);
        await pickDate(user, "Settlement date", "2025-06-05");
        await user.click(screen.getByRole("button", { name: "Preview settlement" }));

        await waitFor(() =>
            expect(screen.getByLabelText("Settlement date")).toHaveAccessibleDescription(
                "Settlement date cannot be after 2100-12-31"
            )
        );
    });

    it("rejects a settlement before funding on the client without calling the API", async () => {
        const user = userEvent.setup();
        renderWithProviders(<SettlementForm invoice={invoice} />);
        await pickDate(user, "Settlement date", "2024-12-30");
        await user.click(screen.getByRole("button", { name: "Preview settlement" }));

        expect(screen.getByLabelText("Settlement date")).toHaveAccessibleDescription(
            /before the funding date \(2024-12-31\)/
        );
        expect(previewSettlement).not.toHaveBeenCalled();
    });
});
