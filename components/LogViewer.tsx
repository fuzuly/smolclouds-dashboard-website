"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { highlight, logFileName, searchLog } from "@/lib/log-search";

const CONTROL =
  "border border-line bg-surface-2 px-3 py-1.5 text-[11px] text-dim focus:border-line-bright focus:outline-none";
const BUTTON =
  "border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-line-bright hover:text-text disabled:opacity-40";

/**
 * One deployment's console output with search, a matching-lines-only view,
 * download and a manual refresh. Refresh re-renders the page on the server,
 * which keeps the search box and scroll position; there is deliberately no
 * polling, so an idle tab never keeps calling the router.
 */
export function LogViewer({
  text,
  app,
  deployment,
}: {
  text: string;
  app: string;
  deployment?: string;
}) {
  const router = useRouter();
  const [needle, setNeedle] = useState("");
  const [onlyMatches, setOnlyMatches] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const { lines, matches } = useMemo(() => searchLog(text, needle), [text, needle]);
  const searching = needle.trim() !== "";
  const shown = searching && onlyMatches ? lines.filter((line) => line.match) : lines;

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = logFileName(app, deployment);
    link.click();
    // Revoking in the same tick can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={needle}
          onChange={(event) => setNeedle(event.target.value)}
          placeholder="search logs"
          aria-label="Search logs"
          spellCheck={false}
          disabled={!text}
          className={`${CONTROL} min-w-0 flex-1 basis-40 placeholder:text-ghost disabled:opacity-40`}
        />
        <label className="flex items-center gap-2 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={onlyMatches}
            onChange={(event) => setOnlyMatches(event.target.checked)}
            disabled={!searching}
            className="accent-white"
          />
          matching lines only
        </label>
        <button type="button" onClick={download} disabled={!text} className={BUTTON}>
          download
        </button>
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
          className={BUTTON}
        >
          {refreshing ? "refreshing…" : "refresh"}
        </button>
      </div>

      {searching ? (
        <p className="mb-3 text-[11px] tabular-nums text-faint" aria-live="polite">
          {matches} matching {matches === 1 ? "line" : "lines"} of {lines.length}
        </p>
      ) : null}

      {!text ? (
        <p className="text-[11px] leading-5 text-dim">No console output recorded yet.</p>
      ) : shown.length === 0 ? (
        <p className="text-[11px] leading-5 text-muted">No line matches “{needle.trim()}”.</p>
      ) : (
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-dim">
          {shown.map((line) => (
            <div key={line.number} className={line.match ? "text-text" : undefined}>
              {searching && onlyMatches ? (
                <span aria-hidden className="mr-3 inline-block w-10 select-none text-right text-ghost">
                  {line.number}
                </span>
              ) : null}
              {highlight(line.text, needle).map((segment, index) =>
                segment.hit ? (
                  <mark key={index} className="bg-dim text-bg">
                    {segment.text}
                  </mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
              {line.text === "" ? " " : null}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}
