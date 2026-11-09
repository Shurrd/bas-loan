import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/app";
import { getInvoices, getLoans } from "@/services/func";
import { renderWithProviders } from "@/test/render";

vi.mock("@/services/func");

describe("App", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getLoans).mockResolvedValue([]);
        vi.mocked(getInvoices).mockResolvedValue([]);
    });

    it("opens on the loans list", async () => {
        renderWithProviders(<App />, "/");
        expect(await screen.findByRole("heading", { name: "Loans" })).toBeInTheDocument();
    });

    it("has Loans and Invoices in the navigation, not the create screens", () => {
        renderWithProviders(<App />, "/");

        const nav = screen.getByRole("navigation");
        expect(nav).toHaveTextContent("Loans");
        expect(nav).toHaveTextContent("Invoices");
        expect(screen.getByRole("link", { name: "Loans" })).toHaveAttribute(
            "href",
            "/loans"
        );
        expect(screen.getByRole("link", { name: "Invoices" })).toHaveAttribute(
            "href",
            "/invoices"
        );
        expect(within(nav).queryByRole("link", { name: /^New/ })).not.toBeInTheDocument();
    });

    it("opens the invoices list", async () => {
        renderWithProviders(<App />, "/invoices");
        expect(
            await screen.findByRole("heading", { name: "Invoices" })
        ).toBeInTheDocument();
    });

    it("opens New loan and New invoice as modals on top of their lists", async () => {
        const user = userEvent.setup();
        const loans = renderWithProviders(<App />, "/loans");
        await user.click(await screen.findByRole("button", { name: "New loan" }));
        expect(
            await screen.findByRole("dialog", { name: "New term loan" })
        ).toBeInTheDocument();
        loans.unmount();

        renderWithProviders(<App />, "/invoices");
        await user.click(await screen.findByRole("button", { name: "New invoice" }));
        expect(
            await screen.findByRole("dialog", { name: "New invoice" })
        ).toBeInTheDocument();
    });

    it("has no separate create pages any more", () => {
        renderWithProviders(<App />, "/loans/new");
        expect(
            screen.queryByRole("heading", { name: "New term loan" })
        ).not.toBeInTheDocument();
    });
});
