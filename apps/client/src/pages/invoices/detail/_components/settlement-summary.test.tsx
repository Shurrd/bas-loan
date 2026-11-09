import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { wireSettlement } from "@/test/fixtures";
import type { SettlementResponse } from "@/types/api";
import SettlementSummary from "./settlement-summary";

const labelled = (label: string) => screen.getByText(label).parentElement as HTMLElement;

describe("SettlementSummary", () => {
    it("shows every figure for the brief's 96-days-overdue shortfall", () => {
        render(<SettlementSummary settlement={wireSettlement("2025-06-05")} />);

        expect(
            within(labelled("Paid by debtor (face value)")).getByText("₦1,000,000.00")
        ).toBeInTheDocument();
        expect(within(labelled("Advance")).getByText("₦800,000.00")).toBeInTheDocument();
        expect(within(labelled("Reserve")).getByText("₦200,000.00")).toBeInTheDocument();
        expect(
            within(labelled("Discount fee")).getByText("₦47,342.47")
        ).toBeInTheDocument();
        expect(within(labelled("Due date")).getByText("2025-03-01")).toBeInTheDocument();
        expect(within(labelled("Days overdue")).getByText("96")).toBeInTheDocument();
        expect(
            within(labelled("Late penalty")).getByText("₦153,600.00")
        ).toBeInTheDocument();
    });

    it("keeps payable at zero and shows the shortfall owed by the client separately", () => {
        render(<SettlementSummary settlement={wireSettlement("2025-06-05")} />);

        expect(
            within(labelled("Payable to client")).getByText("₦0.00")
        ).toBeInTheDocument();
        const shortfall = labelled("Shortfall owed by the client");
        expect(within(shortfall).getByText("₦942.47")).toBeInTheDocument();
        expect(shortfall).not.toBe(labelled("Payable to client"));
    });

    it("shows what is payable to the client and no shortfall on a normal settlement", () => {
        render(<SettlementSummary settlement={wireSettlement("2025-03-01")} />);

        expect(
            within(labelled("Payable to client")).getByText("₦152,657.53")
        ).toBeInTheDocument();
        expect(within(labelled("Days overdue")).getByText("0")).toBeInTheDocument();
        expect(
            screen.queryByText("Shortfall owed by the client")
        ).not.toBeInTheDocument();
    });

    it("shows zero payable and no shortfall when the charges equal the reserve exactly", () => {
        const exact: SettlementResponse = {
            ...wireSettlement("2025-06-12"),
            payableToClient: "0",
            shortfall: "0",
        };
        render(<SettlementSummary settlement={exact} />);

        expect(
            within(labelled("Payable to client")).getByText("₦0.00")
        ).toBeInTheDocument();
        expect(
            screen.queryByText("Shortfall owed by the client")
        ).not.toBeInTheDocument();
    });

    it("never renders a negative payable amount, even if one arrives", () => {
        const odd: SettlementResponse = {
            ...wireSettlement("2025-06-05"),
            payableToClient: "-94247",
        };
        const { container } = render(<SettlementSummary settlement={odd} />);

        expect(
            within(labelled("Payable to client")).getByText("₦0.00")
        ).toBeInTheDocument();
        expect(container.textContent).not.toMatch(/-\s*₦/);
    });

    it("never renders a negative shortfall either", () => {
        const odd: SettlementResponse = {
            ...wireSettlement("2025-03-01"),
            shortfall: "-500",
        };
        const { container } = render(<SettlementSummary settlement={odd} />);

        expect(
            screen.queryByText("Shortfall owed by the client")
        ).not.toBeInTheDocument();
        expect(container.textContent).not.toMatch(/-\s*₦/);
    });
});
