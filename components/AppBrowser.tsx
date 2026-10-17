"use client";

import { useEffect, useMemo, useState } from "react";
import { DeploymentList, type DeploymentRow } from "@/components/DeploymentList";
import {
  appQuerySearch,
  applyAppQuery,
  DEFAULT_QUERY,
  isDefaultQuery,
  type AppQuery,
  type Sort,
  type StateFilter,
} from "@/lib/app-query";

const STATE_LABELS: Record<StateFilter, string> = {
  all: "all states",
  awake: "awake",
  asleep: "asleep",
  starting: "waking",
  error: "error",
};

const SORT_LABELS: Record<Sort, string> = {
  default: "default order",
  recent: "recently used",
  name: "name A–Z",
};

const CONTROL =
  "border border-line bg-surface-2 px-3 py-2 text-[12px] text-dim focus:border-line-bright focus:outline-none";

/**
 * The app list with search, a state filter and an order. Filtering happens in
 * the browser on rows the server already sent, so typing never calls the
 * router; the query is mirrored into the URL so a filtered view can be shared.
 */
export function AppBrowser({ rows, initial }: { rows: DeploymentRow[]; initial: AppQuery }) {
  const [query, setQuery] = useState<AppQuery>(initial);
  const visible = useMemo(() => applyAppQuery(rows, query), [rows, query]);

  useEffect(() => {
    const next = `${window.location.pathname}${appQuerySearch(query)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [query]);

  const filtered = !isDefaultQuery(query);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query.q}
          onChange={(event) => setQuery({ ...query, q: event.target.value })}
          placeholder="search name or URL"
          aria-label="Search apps by name or URL"
          spellCheck={false}
          className={`${CONTROL} min-w-0 flex-1 basis-48 placeholder:text-ghost`}
        />
        <select
          value={query.state}
          onChange={(event) => setQuery({ ...query, state: event.target.value as StateFilter })}
          aria-label="Filter by state"
          className={CONTROL}
        >
          {(Object.keys(STATE_LABELS) as StateFilter[]).map((state) => (
            <option key={state} value={state}>
              {STATE_LABELS[state]}
            </option>
          ))}
        </select>
        <select
          value={query.sort}
          onChange={(event) => setQuery({ ...query, sort: event.target.value as Sort })}
          aria-label="Order apps"
          className={CONTROL}
        >
          {(Object.keys(SORT_LABELS) as Sort[]).map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </option>
          ))}
        </select>
        {filtered ? (
          <button
            type="button"
            onClick={() => setQuery(DEFAULT_QUERY)}
            className="px-2 py-2 text-[11px] text-muted underline decoration-ghost underline-offset-4 transition-colors hover:text-dim"
          >
            clear
          </button>
        ) : null}
      </div>

      {filtered ? (
        <p className="mb-3 text-[11px] tabular-nums text-faint" aria-live="polite">
          showing {visible.length} of {rows.length}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="border border-line bg-surface px-6 py-10 text-center">
          <p className="text-[13px] text-dim">No apps match.</p>
          <button
            type="button"
            onClick={() => setQuery(DEFAULT_QUERY)}
            className="mt-3 text-[11px] text-muted underline decoration-ghost underline-offset-4 transition-colors hover:text-dim"
          >
            clear the search and filters
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-x-6 border-x border-t border-line bg-surface-2 py-2.5 pl-6 pr-5 text-[10px] uppercase tracking-[0.22em] text-ghost">
            <span className="flex-1">app</span>
            <span className="w-[6.5rem]">state</span>
            <span className="w-28 text-right">last request</span>
            <span className="w-24 shrink-0" />
          </div>
          <DeploymentList deployments={visible} />
        </>
      )}
    </>
  );
}
