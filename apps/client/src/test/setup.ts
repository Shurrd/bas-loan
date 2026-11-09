import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Toasts are asserted through the mock, so no Toaster needs to be mounted
vi.mock("sonner", () => ({
    toast: { error: vi.fn(), success: vi.fn() },
    Toaster: () => null,
}));

// jsdom has no ResizeObserver or scrollIntoView, which the popover and react-select use
globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};
Element.prototype.scrollIntoView = () => {};

afterEach(cleanup);
