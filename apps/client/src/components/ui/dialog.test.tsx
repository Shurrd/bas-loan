import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "./dialog";

const open = () =>
    render(
        <Dialog open>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Example</DialogTitle>
                    <DialogDescription>Body</DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );

describe("Dialog motion", () => {
    it("animates the panel and the backdrop on open and close, and respects reduced motion", () => {
        open();
        const panel = screen.getByRole("dialog");
        const overlay = document.querySelector('[data-slot="dialog-overlay"]');

        expect(panel).toHaveAttribute("data-state", "open");
        for (const element of [panel, overlay]) {
            expect(element?.className).toContain("data-[state=open]:animate-in");
            expect(element?.className).toContain("data-[state=closed]:animate-out");
            expect(element?.className).toContain("motion-reduce:animate-none");
        }
        expect(panel.className).toContain("data-[state=open]:zoom-in-95");
        expect(panel.className).toContain("data-[state=open]:slide-in-from-bottom-6");
    });

    it("closes faster than it opens", () => {
        open();
        const classes = screen.getByRole("dialog").className;
        expect(classes).toContain("data-[state=open]:duration-250");
        expect(classes).toContain("data-[state=closed]:duration-150");
    });
});

// Radix sets data-state, not data-open. A rule keyed on the wrong attribute never matches, so
// the animation silently does nothing. This keeps the primitives from slipping back.
describe("ui primitives", () => {
    it("key their animations on Radix's data-state, never data-open or data-closed", () => {
        const dir = resolve("src/components/ui");
        const files = readdirSync(dir).filter(
            (name) => name.endsWith(".tsx") && !name.includes(".test.")
        );
        expect(files.length).toBeGreaterThan(0);

        for (const name of files) {
            const source = readFileSync(join(dir, name), "utf8");
            expect(source, name).not.toMatch(/data-(open|closed):/);
        }
    });
});
