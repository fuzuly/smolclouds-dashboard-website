import { describe, expect, it } from "vitest";
import {
  appQuerySearch,
  applyAppQuery,
  DEFAULT_QUERY,
  isDefaultQuery,
  parseAppQuery,
} from "@/lib/app-query";
import type { Deployment } from "@/lib/router";

/**
 * The /apps search reads its state from the URL, so a shared or bookmarked
 * link must open the same view, and a link with junk in it must open the
 * plain list rather than an empty one.
 */
const apps: Deployment[] = [
  { id: "a1", name: "sales-dashboard", url: "https://sales.smolclouds.com", state: "awake", lastRequestAt: "2026-10-18T09:00:00Z" },
  { id: "a2", name: "Invoice-tool", state: "asleep", lastRequestAt: "2026-10-10T09:00:00Z" },
  { id: "a3", name: "admin-api", url: "https://admin.smolclouds.com", state: "asleep" },
  { id: "a4", name: "webhook-relay", state: "error", lastRequestAt: "2026-10-18T10:00:00Z" },
];

const ids = (rows: Deployment[]) => rows.map((row) => row.id);

describe("parseAppQuery", () => {
  it("reads q, state and sort", () => {
    expect(parseAppQuery({ q: " sales ", state: "awake", sort: "name" })).toEqual({
      q: "sales",
      state: "awake",
      sort: "name",
    });
  });

  it("falls back to defaults for missing or unknown values", () => {
    expect(parseAppQuery({})).toEqual(DEFAULT_QUERY);
    expect(parseAppQuery({ state: "sleeping", sort: "random" })).toEqual(DEFAULT_QUERY);
  });

  it("takes the first value when a parameter repeats, and caps the search length", () => {
    expect(parseAppQuery({ state: ["error", "awake"] }).state).toBe("error");
    expect(parseAppQuery({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("appQuerySearch", () => {
  it("leaves defaults out so the plain list keeps a plain URL", () => {
    expect(appQuerySearch(DEFAULT_QUERY)).toBe("");
    expect(isDefaultQuery({ ...DEFAULT_QUERY, q: "   " })).toBe(true);
  });

  it("round-trips through parseAppQuery", () => {
    const query = { q: "sales dash", state: "awake", sort: "recent" } as const;
    const search = appQuerySearch(query);
    const params = Object.fromEntries(new URLSearchParams(search));
    expect(parseAppQuery(params)).toEqual(query);
  });
});

describe("applyAppQuery", () => {
  it("returns the router's order untouched by default", () => {
    expect(ids(applyAppQuery(apps, DEFAULT_QUERY))).toEqual(["a1", "a2", "a3", "a4"]);
  });

  it("searches name, id and URL, case-insensitively", () => {
    expect(ids(applyAppQuery(apps, { ...DEFAULT_QUERY, q: "INVOICE" }))).toEqual(["a2"]);
    expect(ids(applyAppQuery(apps, { ...DEFAULT_QUERY, q: "admin.smolclouds" }))).toEqual(["a3"]);
    expect(ids(applyAppQuery(apps, { ...DEFAULT_QUERY, q: "a4" }))).toEqual(["a4"]);
    expect(ids(applyAppQuery(apps, { ...DEFAULT_QUERY, q: "nothing-like-this" }))).toEqual([]);
  });

  it("filters by state", () => {
    expect(ids(applyAppQuery(apps, { ...DEFAULT_QUERY, state: "asleep" }))).toEqual(["a2", "a3"]);
    expect(ids(applyAppQuery(apps, { ...DEFAULT_QUERY, state: "starting" }))).toEqual([]);
  });

  it("orders by most recent request, never-used last", () => {
    expect(ids(applyAppQuery(apps, { ...DEFAULT_QUERY, sort: "recent" }))).toEqual([
      "a4",
      "a1",
      "a2",
      "a3",
    ]);
  });

  it("orders by name regardless of case", () => {
    expect(ids(applyAppQuery(apps, { ...DEFAULT_QUERY, sort: "name" }))).toEqual([
      "a3",
      "a2",
      "a1",
      "a4",
    ]);
  });

  it("combines search, filter and order, and never mutates the input", () => {
    const before = ids(apps);
    expect(
      ids(applyAppQuery(apps, { q: "smolclouds", state: "all", sort: "name" })),
    ).toEqual(["a3", "a1"]);
    expect(ids(apps)).toEqual(before);
  });
});
