"use client";

import { useState, useTransition } from "react";
import { rollbackRevision } from "@/app/(console)/apps/actions";

export function RollbackButton({ appId, revision }: { appId: string; revision: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await rollbackRevision(appId, revision);
      if (!result.ok) setError(result.error);
      setConfirming(false);
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2 text-[11px]">
      {error ? <span className="text-dim">{error}</span> : null}
      {confirming ? (
        <>
          <span className="text-muted">switch live traffic?</span>
          <button type="button" disabled={pending} onClick={submit} className="border border-text bg-text px-2 py-1 text-bg">
            {pending ? "switching…" : "confirm"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-muted">cancel</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="border border-line px-2 py-1 text-dim hover:border-line-bright">
          rollback
        </button>
      )}
    </span>
  );
}
