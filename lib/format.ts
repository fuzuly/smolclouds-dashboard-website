/**
 * Number formatting for metered usage, shared by /usage and the app detail
 * page so the same figure reads the same way in both places.
 */

const BYTE = 1024;
const COUNT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)} h`;
}

export function formatBytes(bytes: number): string {
  const gigabytes = bytes / BYTE ** 3;
  if (gigabytes >= 1) return `${gigabytes.toFixed(1)} GB`;
  return `${(bytes / BYTE ** 2).toFixed(1)} MB`;
}

export function formatCount(value: number): string {
  return COUNT.format(Math.round(value));
}

/** The current billing month, `YYYY-MM`, in UTC. */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** `2026-10` → "October 2026". */
export function monthName(month: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}
