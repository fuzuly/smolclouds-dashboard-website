import { describe, expect, it } from "vitest";
import { highlight, logFileName, searchLog } from "@/lib/log-search";

/**
 * Search is how someone finds the one failing line in a build log, so it
 * must not miss a hit because of case, must number lines the way an editor
 * would, and must never drop or reorder the text it is highlighting.
 */
const log = "Starting build\nnpm install\nERROR: missing module\nretrying\nError again\n";

describe("searchLog", () => {
  it("numbers every line from 1 and ignores a trailing newline", () => {
    const { lines } = searchLog(log, "");
    expect(lines.map((line) => line.number)).toEqual([1, 2, 3, 4, 5]);
    expect(lines[4].text).toBe("Error again");
  });

  it("matches case-insensitively and counts matching lines", () => {
    const { lines, matches } = searchLog(log, "error");
    expect(matches).toBe(2);
    expect(lines.filter((line) => line.match).map((line) => line.number)).toEqual([3, 5]);
  });

  it("treats a blank search as no search", () => {
    expect(searchLog(log, "   ").matches).toBe(0);
  });

  it("handles Windows line endings", () => {
    expect(searchLog("a\r\nb\r\n", "b").lines).toEqual([
      { number: 1, text: "a", match: false },
      { number: 2, text: "b", match: true },
    ]);
  });
});

describe("highlight", () => {
  it("marks every occurrence and keeps the original text and case", () => {
    const segments = highlight("Error: error ERROR", "error");
    expect(segments.filter((s) => s.hit).map((s) => s.text)).toEqual(["Error", "error", "ERROR"]);
    expect(segments.map((s) => s.text).join("")).toBe("Error: error ERROR");
  });

  it("returns the line untouched when there is nothing to find", () => {
    expect(highlight("plain line", "")).toEqual([{ text: "plain line", hit: false }]);
    expect(highlight("plain line", "zzz")).toEqual([{ text: "plain line", hit: false }]);
  });
});

describe("logFileName", () => {
  it("builds a safe name from the app and a short deployment id", () => {
    expect(logFileName("sales-dashboard", "0123456789abcdef0123")).toBe(
      "sales-dashboard-0123456789ab.log",
    );
    expect(logFileName("my app/v2")).toBe("my-app-v2.log");
    expect(logFileName("///")).toBe("app.log");
  });
});
