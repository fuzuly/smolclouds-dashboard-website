import { describe, expect, it } from "vitest";
import { currentMonth, formatBytes, formatCount, formatHours, monthName } from "@/lib/format";

/**
 * These helpers moved out of the /usage page unchanged. The expectations pin
 * the output /usage already showed, so the move cannot change a figure —
 * including the known rough edge that anything under a megabyte reads 0.0 MB.
 */
describe("formatHours", () => {
  it("shows hours to one decimal", () => {
    expect(formatHours(0)).toBe("0.0 h");
    expect(formatHours(402)).toBe("0.1 h");
    expect(formatHours(5400)).toBe("1.5 h");
  });
});

describe("formatBytes", () => {
  it("uses GB from one binary gigabyte, MB below it", () => {
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
    expect(formatBytes(2.5 * 1024 ** 3)).toBe("2.5 GB");
    expect(formatBytes(5 * 1024 ** 2)).toBe("5.0 MB");
    expect(formatBytes(1024 ** 3 - 1)).toBe("1024.0 MB");
  });

  it("keeps the existing reading for less than a megabyte", () => {
    expect(formatBytes(500)).toBe("0.0 MB");
    expect(formatBytes(0)).toBe("0.0 MB");
  });
});

describe("formatCount", () => {
  it("rounds and groups thousands", () => {
    expect(formatCount(17)).toBe("17");
    expect(formatCount(1234.6)).toBe("1,235");
    expect(formatCount(1_000_000)).toBe("1,000,000");
  });
});

describe("months", () => {
  it("names a month in UTC", () => {
    expect(monthName("2026-10")).toBe("October 2026");
    expect(monthName("2026-01")).toBe("January 2026");
  });

  it("gives the current month as YYYY-MM", () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
    expect(currentMonth()).toBe(new Date().toISOString().slice(0, 7));
  });
});
