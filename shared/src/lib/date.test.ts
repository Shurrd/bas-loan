import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, isValidDate } from "./date";

describe("dates", () => {
    it("counts calendar days across month, year and leap boundaries", () => {
        expect(daysBetween("2025-03-01", "2025-03-01")).toBe(0);
        expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
        expect(daysBetween("2025-02-28", "2025-03-01")).toBe(1);
        expect(daysBetween("2024-12-31", "2025-01-01")).toBe(1);
        expect(daysBetween("2025-03-10", "2025-03-01")).toBe(-9);
    });

    it("adds months and clamps to month end", () => {
        expect(addMonths("2025-01-31", 1)).toBe("2025-02-28");
        expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
        expect(addMonths("2025-11-30", 3)).toBe("2026-02-28");
        expect(addMonths("2025-12-15", 1)).toBe("2026-01-15");
        expect(addMonths("2025-01-15", 60)).toBe("2030-01-15");
    });

    it("rejects impossible and malformed dates", () => {
        expect(isValidDate("2025-02-29")).toBe(false);
        expect(isValidDate("2025-13-01")).toBe(false);
        expect(isValidDate("2025-1-01")).toBe(false);
        expect(isValidDate("2024-02-29")).toBe(true);
    });
});
