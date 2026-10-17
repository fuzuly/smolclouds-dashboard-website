/**
 * Plain-text search over a log, kept apart from the viewer so the matching
 * rules can be tested without rendering.
 */

export type LogLine = { number: number; text: string; match: boolean };
export type Segment = { text: string; hit: boolean };

function normalise(needle: string): string {
  return needle.trim().toLowerCase();
}

/** Every line of the log, numbered from 1, marked if it contains the needle (case-insensitive). */
export function searchLog(text: string, needle: string): { lines: LogLine[]; matches: number } {
  const query = normalise(needle);
  const lines = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").map((line, index) => ({
    number: index + 1,
    text: line,
    match: query !== "" && line.toLowerCase().includes(query),
  }));
  return { lines, matches: lines.filter((line) => line.match).length };
}

/** Splits a line into plain and matching runs so the viewer can mark each hit. */
export function highlight(line: string, needle: string): Segment[] {
  const query = normalise(needle);
  if (!query) return [{ text: line, hit: false }];

  const lower = line.toLowerCase();
  const segments: Segment[] = [];
  let from = 0;
  for (let at = lower.indexOf(query); at !== -1; at = lower.indexOf(query, from)) {
    if (at > from) segments.push({ text: line.slice(from, at), hit: false });
    segments.push({ text: line.slice(at, at + query.length), hit: true });
    from = at + query.length;
  }
  if (from < line.length) segments.push({ text: line.slice(from), hit: false });
  return segments.length ? segments : [{ text: line, hit: false }];
}

/** A filesystem-safe name for a downloaded log. */
export function logFileName(app: string, deployment?: string): string {
  const safe = (value: string) => value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  const parts = [safe(app) || "app", deployment ? safe(deployment.slice(0, 12)) : ""].filter(Boolean);
  return `${parts.join("-")}.log`;
}
