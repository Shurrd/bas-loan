import { parseRate } from "./rate";

export const ADVANCE_RATE = parseRate("80");
export const DISCOUNT_ANNUAL_RATE = parseRate("36");
export const PENALTY_RATE_PER_DAY = parseRate("0.2");
export const DAYS_IN_YEAR = 365n;

export const MAX_KOBO = 9_223_372_036_854_775_807n; // largest value SQLite can store

// Keeps penalty (advance x 0.2% x days overdue) far inside what SQLite can store
export const MAX_INVOICE_KOBO = 10n ** 14n;
export const MAX_DATE = "2100-12-31";
