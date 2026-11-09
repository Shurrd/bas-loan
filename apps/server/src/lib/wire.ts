import type { Wire } from "@lending/shared";

// Kobo crosses the wire as strings, so every bigint is converted before JSON.stringify sees it
export const toWire = <T>(value: T): Wire<T> => {
    if (typeof value === "bigint") return value.toString() as Wire<T>;
    if (Array.isArray(value)) return value.map(toWire) as Wire<T>;
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, toWire(item)])
        ) as Wire<T>;
    }
    return value as Wire<T>;
};
