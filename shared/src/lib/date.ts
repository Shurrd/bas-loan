const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const parseDate = (date: string) => {
    const match = DATE_PATTERN.exec(date);
    if (!match) throw new Error(`Invalid date: ${date}`);

    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const check = new Date(Date.UTC(year, month - 1, day));
    const exists =
        check.getUTCFullYear() === year &&
        check.getUTCMonth() === month - 1 &&
        check.getUTCDate() === day;
    if (!exists) throw new Error(`Invalid date: ${date}`);

    return { year, month, day };
};

export const isValidDate = (date: string) => {
    try {
        parseDate(date);
        return true;
    } catch {
        return false;
    }
};

// UTC midnights, so the local time zone never changes the count
export const daysBetween = (earlier: string, later: string) => {
    const from = parseDate(earlier);
    const to = parseDate(later);
    return (
        (Date.UTC(to.year, to.month - 1, to.day) -
            Date.UTC(from.year, from.month - 1, from.day)) /
        MS_PER_DAY
    );
};

const toIso = (year: number, month: number, day: number) =>
    [
        String(year).padStart(4, "0"),
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0"),
    ].join("-");

// Clamps to month end: 31 Jan + 1 month = 28 Feb
export const addMonths = (date: string, months: number) => {
    const { year, month, day } = parseDate(date);
    const total = year * 12 + (month - 1) + months;
    const newYear = Math.floor(total / 12);
    const newMonth = (total % 12) + 1;
    const lastDay = new Date(Date.UTC(newYear, newMonth, 0)).getUTCDate();

    return toIso(newYear, newMonth, Math.min(day, lastDay));
};

export const addDays = (date: string, days: number) => {
    const { year, month, day } = parseDate(date);
    const next = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY);
    return toIso(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
};
