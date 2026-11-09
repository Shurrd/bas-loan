import { afterEach, describe, expect, it, vi } from "vitest";
import { fileNameFromDisposition, saveBlob } from "./download";

describe("fileNameFromDisposition", () => {
    it("reads the file name the server chose", () => {
        expect(
            fileNameFromDisposition(
                'attachment; filename="loan-12-statement.pdf"',
                "fallback.pdf"
            )
        ).toBe("loan-12-statement.pdf");
    });

    it("falls back when the header is missing or has no file name", () => {
        expect(fileNameFromDisposition(undefined, "fallback.pdf")).toBe("fallback.pdf");
        expect(fileNameFromDisposition("attachment", "fallback.pdf")).toBe(
            "fallback.pdf"
        );
    });
});

describe("saveBlob", () => {
    const originalClick = HTMLAnchorElement.prototype.click;

    afterEach(() => {
        HTMLAnchorElement.prototype.click = originalClick;
        vi.restoreAllMocks();
    });

    it("downloads the blob under the given name and releases the object URL", () => {
        const clicked: HTMLAnchorElement[] = [];
        URL.createObjectURL = vi.fn(() => "blob:statement");
        URL.revokeObjectURL = vi.fn();
        HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
            clicked.push(this);
        };

        const blob = new Blob(["%PDF-"], { type: "application/pdf" });
        saveBlob(blob, "loan-1-statement.pdf");

        expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
        expect(clicked).toHaveLength(1);
        expect(clicked[0]?.download).toBe("loan-1-statement.pdf");
        expect(clicked[0]?.getAttribute("href")).toBe("blob:statement");
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:statement");
    });
});
