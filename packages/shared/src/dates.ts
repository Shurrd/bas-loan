const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function parseDate(date: string): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new Error(`Invalid date: ${date}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Date.UTC maps years 0-99 to 1900-1999, so the round trip also rejects those.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Invalid date: ${date}`);
  }
  return { year, month, day };
}

function formatDate(year: number, month: number, day: number): string {
  const pad = (value: number, width: number) => String(value).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function isValidDate(date: string): boolean {
  try {
    parseDate(date);
    return true;
  } catch {
    return false;
  }
}

// Both dates are read as UTC midnights, so the local time zone never matters.
export function daysBetween(earlier: string, later: string): number {
  const a = parseDate(earlier);
  const b = parseDate(later);
  const aMs = Date.UTC(a.year, a.month - 1, a.day);
  const bMs = Date.UTC(b.year, b.month - 1, b.day);
  return (bMs - aMs) / MS_PER_DAY;
}

// Clamps to month end when the day does not exist (31 Jan + 1 month = 28/29 Feb).
export function addMonths(date: string, months: number): string {
  const { year, month, day } = parseDate(date);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(newYear, newMonth, 0)).getUTCDate();
  return formatDate(newYear, newMonth, Math.min(day, lastDay));
}
