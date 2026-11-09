import { describe, expect, it } from "vitest";
import { toWire } from "./wire";

describe("toWire", () => {
    it("turns every bigint into a string, however deep", () => {
        const wire = toWire({
            principal: 9_007_199_254_740_993n,
            rows: [{ amount: 1n }, { amount: 0n }],
            nested: { list: [[2n]] },
        });
        expect(wire).toEqual({
            principal: "9007199254740993",
            rows: [{ amount: "1" }, { amount: "0" }],
            nested: { list: [["2"]] },
        });
    });

    it("leaves strings, numbers, booleans and null alone", () => {
        expect(toWire({ a: "x", b: 6, c: true, d: null })).toEqual({
            a: "x",
            b: 6,
            c: true,
            d: null,
        });
    });

    it("makes the result safe for JSON.stringify, which throws on a raw bigint", () => {
        expect(() => JSON.stringify({ amount: 1n })).toThrow();
        expect(JSON.stringify(toWire({ amount: 1n }))).toBe('{"amount":"1"}');
    });
});
