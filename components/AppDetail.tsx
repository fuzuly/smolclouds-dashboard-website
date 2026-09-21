"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { removeDeployment } from "@/app/(console)/apps/actions";
import { CopyButton } from "@/components/Copy";
import { Field, PageHeader, Panel, Rule, StatusBadge } from "@/components/ui";
import type { Deployment } from "@/lib/router";
import { ago } from "@/lib/time";

/**
 * The single-app view. Everything the router tells us about one deployment,
 * laid out so the two things people come here for — the URL, and whether it
 * is awake — are the first things on the page.
 */
export function AppDetail({
  deployment,
  agoLabel,
  exactLabel,
  createdLabel,
}: {
  deployment: Deployment;
  /** Rendered on the server so the first client paint cannot disagree. */
  agoLabel: string;
  exactLabel: string;
  createdLabel: string;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(agoLabel);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!deployment.lastRequestAt) return;
    const tick = () => setLabel(ago(deployment.lastRequestAt));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [deployment.lastRequestAt]);

  const host = deployment.url?.replace(/^https?:\/\//, "");

  function destroy() {
    setError(null);
    startTransition(async () => {
      const result = await removeDeployment(deployment.id);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.push("/apps");
    });
  }

  return (
    <>
      <PageHeader
        label="app"
        title={deployment.name}
        right={
          <Link
            href="/apps"
            className="text-muted underline decoration-ghost underline-offset-4 transition-colors hover:text-dim hover:decoration-muted"
          >
            ← all apps
          </Link>
        }
      />

      {deployment.url ? (
        <Panel className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
          <a
            href={deployment.url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-[13px] text-dim underline decoration-ghost underline-offset-4 transition-colors hover:text-text hover:decoration-muted"
          >
            {host} ↗
          </a>
          <StatusBadge state={deployment.state} />
          <CopyButton value={deployment.url} label="copy url" />
        </Panel>
      ) : (
        <Panel className="px-5 py-4 text-[13px] text-muted">
          No public URL yet — the router has not assigned one to this app.
        </Panel>
      )}

      <section className="mt-12">
        <Rule label="details" />
        <Panel className="px-5">
          <Field label="state" value={<StatusBadge state={deployment.state} />} />
          <Field
            label="last request"
            value={
              <span className="tabular-nums" title={exactLabel}>
                {label}
              </span>
            }
          />
          <Field label="created" value={<span className="tabular-nums">{createdLabel}</span>} />
          <Field
            label="id"
            value={
              <span className="inline-flex items-center gap-3">
                <code className="text-[12px]">{deployment.id}</code>
                <CopyButton value={deployment.id} label="copy" />
              </span>
            }
          />
        </Panel>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Asleep means no machine is running and no active compute is billed. The next request
          restores it from its snapshot.
        </p>
      </section>

      <section className="mt-12">
        <Rule label="redeploy" />
        <Panel className="px-5 py-4">
          <p className="text-[13px] text-dim">From the project directory:</p>
          <div className="mt-3 flex items-center gap-3 border border-line bg-surface-2 px-4 py-2.5">
            <span aria-hidden className="select-none text-faint">
              $
            </span>
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre text-[13px] text-dim">
              smolclouds deploy . --name {deployment.name}
            </code>
            <CopyButton value={`smolclouds deploy . --name ${deployment.name}`} label="copy" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            A failed deploy leaves the current version serving. Nothing is switched over until the
            new build answers a health check.
          </p>
        </Panel>
      </section>

      <section className="mt-12">
        <Rule label="danger" />
        <Panel className="px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[13px] text-dim">Delete this app and its storage.</p>
            {confirming ? (
              <span className="inline-flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={destroy}
                  disabled={pending}
                  className="border border-text bg-text px-2.5 py-1 text-bg transition-colors hover:bg-dim disabled:opacity-40"
                >
                  {pending ? "deleting…" : "delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="px-1.5 py-1 text-muted transition-colors hover:text-dim"
                >
                  cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="border border-line px-3 py-1 text-[11px] text-faint transition-all hover:border-line-bright hover:text-text"
              >
                delete
              </button>
            )}
          </div>
          {confirming ? (
            <p className="mt-4 border-l border-line-bright pl-4 text-[11px] leading-relaxed text-muted">
              Deleting <span className="text-dim">{deployment.name}</span> removes the app, its
              snapshot and its storage. The URL stops answering. This cannot be undone.
            </p>
          ) : null}
          {error ? <p className="mt-4 text-[11px] text-dim">✕ {error}</p> : null}
        </Panel>
      </section>
    </>
  );
}
