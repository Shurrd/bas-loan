import type { FieldError } from "@lending/shared";
import { isAxiosError } from "axios";

export const getFieldErrors = (error: unknown): FieldError[] =>
    isAxiosError(error) &&
    error.response?.status === 400 &&
    Array.isArray(error.response.data?.errors)
        ? error.response.data.errors
        : [];

// No answer at all, or a 5xx: the API is down or broken, whatever the officer typed
export const isServerProblem = (error: unknown) =>
    isAxiosError(error) && (!error.response || error.response.status >= 500);

export const serverProblemMessage = (error: unknown) => {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (status === undefined)
        return "Can't reach the server. Check that the API is running and try again.";
    if ([502, 503, 504].includes(status)) {
        return `The server isn't responding (${status}). Check that the API is running and try again.`;
    }
    return "The server hit an error. Try again.";
};

export const errorMessage = (error: unknown) =>
    isServerProblem(error)
        ? serverProblemMessage(error)
        : (isAxiosError(error) && error.response?.data?.message) ||
          "Something went wrong. Try again.";

// Server problems already show as a toast, so a form does not repeat them
export const inlineMessage = (error: unknown) =>
    isServerProblem(error) ? "" : errorMessage(error);

export const errorField = (error: unknown, field: "code" | "loanId" | "invoiceId") =>
    isAxiosError(error) && error.response?.status === 409
        ? (error.response.data?.[field] as string | undefined)
        : undefined;
