"use client";

import { useState, useTransition } from "react";
import { rotate } from "@/app/(console)/token/actions";
import { CopyButton } from "@/components/Copy";

export function TokenPanel({ token, createdAt }: { token: string; createdAt: string }) {
  const [current, setCurrent] = useState(token);
  const [issued, setIssued] = useState(createdAt);
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const masked = `${current.slice(0, 14)}${"•".repeat(22)}${current.slice(-4)}`;

  return (
    <div className="border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-5">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[13px] text-dim">
          {revealed ? current : masked}
        </code>
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="shrink-0 border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-line-bright hover:text-text"
        >
          {revealed ? "hide" : "reveal"}
        </button>
        <CopyButton
          value={current}
          label="copy token"
          onFallback={() => setRevealed(true)}
          className="border-text bg-text text-bg hover:bg-dim"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 text-[11px] text-faint">
        <span className="tabular-nums">
          issued {new Date(issued).toISOString().slice(0, 16).replace("T", " ")} UTC
        </span>

        <span className="ml-auto flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-muted">Rotating replaces this token with a new one.</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await rotate();
                    setCurrent(result.token);
                    setIssued(result.createdAt);
                    setRevealed(true);
                    setConfirming(false);
                  })
                }
                className="border border-text bg-text px-2.5 py-1 text-bg transition-colors hover:bg-dim"
              >
                {pending ? "rotating…" : "confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-1.5 py-1 transition-colors hover:text-dim"
              >
                cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="border border-line px-3 py-1 text-muted transition-colors hover:border-line-bright hover:text-text"
            >
              rotate
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
