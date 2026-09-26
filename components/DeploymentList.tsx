"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { Deployment } from "@/lib/router";
import { removeDeployment } from "@/app/(console)/apps/actions";
import { StateRail, StatusBadge } from "@/components/ui";
import { ago } from "@/lib/time";

export type DeploymentRow = Deployment & {
  /**
   * Rendered on the server. A relative time computed in both places disagrees
   * by a second and trips hydration, so the first client render reuses this
   * string and only later renders recompute it.
   */
  agoLabel: string;
  exactLabel: string;
};

export function DeploymentList({ deployments }: { deployments: DeploymentRow[] }) {
  return (
    <ul className="border border-line">
      {deployments.map((deployment, index) => (
        <li
          key={deployment.id}
          className="animate-boot"
          style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
        >
          <Row deployment={deployment} />
        </li>
      ))}
    </ul>
  );
}

function Row({ deployment }: { deployment: DeploymentRow }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(deployment.agoLabel);

  useEffect(() => {
    if (!deployment.lastRequestAt) return;
    const tick = () => setLabel(ago(deployment.lastRequestAt));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [deployment.lastRequestAt]);

  function destroy() {
    setError(null);
    startTransition(async () => {
      const result = await removeDeployment(deployment.id);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <div
      className={`group relative border-b border-line bg-surface py-4 pl-6 pr-5 transition-colors last:border-b-0 hover:bg-surface-2 ${
        pending ? "opacity-40" : ""
      }`}
    >
      <StateRail state={deployment.state} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <Link href={`/apps/${deployment.id}`} className="block truncate text-[13px] hover:underline">
            {deployment.name} <span className="text-ghost">↗</span>
          </Link>
          {deployment.url ? (
            <a
              href={deployment.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block max-w-full truncate text-[11px] text-muted underline decoration-ghost underline-offset-4 transition-colors hover:text-dim hover:decoration-muted"
            >
              {deployment.url.replace(/^https?:\/\//, "")} ↗
            </a>
          ) : (
            <div className="mt-1 truncate text-[11px] text-ghost">{deployment.id}</div>
          )}
        </div>

        <div className="flex w-[6.5rem] shrink-0 justify-start">
          <StatusBadge state={deployment.state} />
        </div>

        <div
          className="w-28 shrink-0 text-right text-[11px] tabular-nums text-muted"
          title={deployment.exactLabel}
        >
          {label}
        </div>

        <div className="w-24 shrink-0 text-right">
          {confirming ? (
            <span className="inline-flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={destroy}
                disabled={pending}
                className="border border-text bg-text px-2.5 py-1 text-bg transition-colors hover:bg-dim"
              >
                {pending ? "deleting…" : "delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-1.5 py-1 text-muted transition-colors hover:text-dim"
              >
                cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="border border-line px-3 py-1 text-[11px] text-faint opacity-0 transition-all hover:border-line-bright hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
            >
              delete
            </button>
          )}
        </div>
      </div>

      {confirming ? (
        <p className="mt-4 border-l border-line-bright pl-4 text-[11px] leading-relaxed text-muted">
          Deleting <span className="text-dim">{deployment.name}</span> removes the app and its
          storage. This cannot be undone.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-[11px] text-dim">✕ {error}</p> : null}
    </div>
  );
}
