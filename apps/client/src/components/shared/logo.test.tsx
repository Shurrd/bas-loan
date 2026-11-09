import { LOGO_SHAPES } from "@lending/shared";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LogoMark } from "./logo";

describe("LogoMark", () => {
    it("draws every shape of the shared logo", () => {
        const { container } = render(<LogoMark />);

        expect(screen.getByRole("img", { name: "Lending logo" })).toBeInTheDocument();
        expect(container.querySelectorAll("rect")).toHaveLength(
            LOGO_SHAPES.filter((shape) => shape.kind === "rect").length
        );
        expect(container.querySelectorAll("circle")).toHaveLength(
            LOGO_SHAPES.filter((shape) => shape.kind === "circle").length
        );
    });

    it("scales to the size it is given", () => {
        render(<LogoMark size={40} />);
        expect(screen.getByRole("img")).toHaveAttribute("width", "40");
    });
});

describe("favicon", () => {
    const favicon = readFileSync(resolve("public/favicon.svg"), "utf8");

    it("has the same shapes, in the same colours, as the shared logo", () => {
        for (const shape of LOGO_SHAPES) {
            const markup =
                shape.kind === "rect"
                    ? `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.radius}" fill="${shape.fill}"/>`
                    : `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.radius}" fill="${shape.fill}"/>`;
            expect(favicon).toContain(markup);
        }
    });
});
