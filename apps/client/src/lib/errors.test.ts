import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import {
    errorMessage,
    inlineMessage,
    isServerProblem,
    serverProblemMessage,
} from "./errors";

const failure = (status: number, data: unknown = {}) =>
    new AxiosError("Request failed", "ERR", undefined, undefined, {
        status,
        data,
    } as AxiosResponse);

describe("isServerProblem", () => {
    it("treats no answer and any 5xx as a server problem", () => {
        expect(isServerProblem(new AxiosError("Network Error"))).toBe(true);
        for (const status of [500, 502, 503, 504])
            expect(isServerProblem(failure(status))).toBe(true);
    });

    it("does not treat a rejected request as a server problem", () => {
        for (const status of [400, 404, 409])
            expect(isServerProblem(failure(status))).toBe(false);
        expect(isServerProblem(new Error("boom"))).toBe(false);
    });
});

describe("messages", () => {
    it("names a bad gateway and an unreachable server", () => {
        expect(serverProblemMessage(failure(502))).toBe(
            "The server isn't responding (502). Check that the API is running and try again."
        );
        expect(serverProblemMessage(new AxiosError("Network Error"))).toMatch(
            /Can't reach the server/
        );
        expect(serverProblemMessage(failure(500))).toBe(
            "The server hit an error. Try again."
        );
    });

    it("keeps the server's own message for a rejected request", () => {
        expect(errorMessage(failure(409, { message: "Already approved" }))).toBe(
            "Already approved"
        );
        expect(errorMessage(new Error("boom"))).toBe("Something went wrong. Try again.");
    });

    it("leaves server problems out of the form, since they show as a toast", () => {
        expect(inlineMessage(failure(502))).toBe("");
        expect(inlineMessage(failure(409, { message: "Already approved" }))).toBe(
            "Already approved"
        );
    });
});
