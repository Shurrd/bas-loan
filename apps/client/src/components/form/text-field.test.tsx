import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import TextField from "./text-field";

const onChangeSpy = vi.fn();

function Amount({ initial = "" }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return (
        <>
            <TextField
                label="Amount"
                name="amount"
                amount
                value={value}
                onChange={(next) => {
                    onChangeSpy(next);
                    setValue(next);
                }}
            />
            <button type="button" onClick={() => setValue("")}>
                Clear
            </button>
        </>
    );
}

describe("TextField amount", () => {
    it("shows thousands separators as the officer types, and keeps the value a plain string", async () => {
        onChangeSpy.mockClear();
        const user = userEvent.setup();
        render(<Amount />);
        const input = screen.getByLabelText("Amount");

        await user.type(input, "1200000.5");

        expect(input).toHaveValue("1,200,000.5");
        expect(onChangeSpy).toHaveBeenLastCalledWith("1200000.5");
    });

    it("handles a pasted amount that already has commas", async () => {
        onChangeSpy.mockClear();
        const user = userEvent.setup();
        render(<Amount />);
        await user.click(screen.getByLabelText("Amount"));
        await user.paste("5,000,000.25");

        expect(screen.getByLabelText("Amount")).toHaveValue("5,000,000.25");
        expect(onChangeSpy).toHaveBeenLastCalledWith("5000000.25");
    });

    it("ignores letters and a minus sign", async () => {
        const user = userEvent.setup();
        render(<Amount />);
        await user.type(screen.getByLabelText("Amount"), "-12ab3");
        expect(screen.getByLabelText("Amount")).toHaveValue("123");
    });

    it("does not report an edit when the parent clears the value", async () => {
        const user = userEvent.setup();
        render(<Amount initial="1500" />);
        expect(screen.getByLabelText("Amount")).toHaveValue("1,500");

        onChangeSpy.mockClear();
        await user.click(screen.getByRole("button", { name: "Clear" }));

        expect(screen.getByLabelText("Amount")).toHaveValue("");
        expect(onChangeSpy).not.toHaveBeenCalled();
    });

    it("does not format a plain field", async () => {
        const user = userEvent.setup();
        function Plain() {
            const [value, setValue] = useState("");
            return (
                <TextField label="Rate" name="rate" value={value} onChange={setValue} />
            );
        }
        render(<Plain />);
        await user.type(screen.getByLabelText("Rate"), "1200000");
        expect(screen.getByLabelText("Rate")).toHaveValue("1200000");
    });
});
