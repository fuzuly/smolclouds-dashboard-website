import type { Deployment } from "@/lib/router";

/**
 * Search, state filter and order for the /apps list. Kept as plain data and
 * pure functions so the page can read it from the URL, the list can apply it
 * in the browser, and a test can pin both without rendering anything.
 */

export const STATE_FILTERS = ["all", "awake", "asleep", "starting", "error"] as const;
export const SORTS = ["default", "recent", "name"] as const;

export type StateFilter = (typeof STATE_FILTERS)[number];
export type Sort = (typeof SORTS)[number];
export type AppQuery = { q: string; state: StateFilter; sort: Sort };

export const DEFAULT_QUERY: AppQuery = { q: "", state: "all", sort: "default" };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Reads a query from search params, ignoring anything it does not recognise. */
export function parseAppQuery(params: Record<string, string | string[] | undefined>): AppQuery {
  return {
    q: first(params.q).trim().slice(0, 100),
    state: oneOf(first(params.state), STATE_FILTERS, DEFAULT_QUERY.state),
    sort: oneOf(first(params.sort), SORTS, DEFAULT_QUERY.sort),
  };
}

/** The search string for a query, leaving out defaults so a plain list keeps a plain URL. */
export function appQuerySearch(query: AppQuery): string {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.state !== DEFAULT_QUERY.state) params.set("state", query.state);
  if (query.sort !== DEFAULT_QUERY.sort) params.set("sort", query.sort);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function isDefaultQuery(query: AppQuery): boolean {
  return appQuerySearch(query) === "";
}

function lastRequest(app: Deployment): number {
  const at = app.lastRequestAt ? new Date(app.lastRequestAt).getTime() : NaN;
  return Number.isNaN(at) ? -Infinity : at;
}

/**
 * Applies a query. "default" keeps the router's order untouched; "recent"
 * puts the most recently used first and never-used last; "name" is A–Z.
 */
export function applyAppQuery<T extends Deployment>(apps: T[], query: AppQuery): T[] {
  const needle = query.q.trim().toLowerCase();
  const matched = apps.filter((app) => {
    if (query.state !== "all" && app.state !== query.state) return false;
    if (!needle) return true;
    return [app.name, app.id, app.url ?? ""].some((field) => field.toLowerCase().includes(needle));
  });

  if (query.sort === "recent") {
    return [...matched].sort((a, b) => lastRequest(b) - lastRequest(a));
  }
  if (query.sort === "name") {
    return [...matched].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }
  return matched;
}
