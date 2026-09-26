import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RollbackButton } from "@/components/RollbackButton";
import { PageHeader, Panel, Rule, StatusBadge } from "@/components/ui";
import { requirePilot } from "@/lib/gate";
import { getAppLogs, listAppRevisions, listDeployments } from "@/lib/router";
import { exact } from "@/lib/time";

export const metadata: Metadata = { title: "App details" };
export const dynamic = "force-dynamic";

export default async function AppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ deployment?: string }>;
}) {
  const [{ id }, { deployment }, user] = await Promise.all([params, searchParams, requirePilot()]);
  const app = (await listDeployments(user.key.token)).find((item) => item.id === id);
  if (!app) notFound();

  let revisions: Awaited<ReturnType<typeof listAppRevisions>> = [];
  let historyError = false;
  try {
    revisions = await listAppRevisions(user.key.token, id);
  } catch {
    historyError = true;
  }
  const selected = revisions.find((item) => item.id === deployment) ?? revisions.find((item) => item.current);
  let logText = "";
  let logsError = false;
  if (selected) {
    try {
      logText = (await getAppLogs(user.key.token, id, selected.id)).text;
    } catch {
      logsError = true;
    }
  }

  return (
    <>
      <PageHeader
        label="app / details"
        title={app.name}
        description="Recent console output and the retained deployment history. Rollback checks the old revision before switching live traffic."
        right={<Link href="/apps" className="hover:text-text">← all apps</Link>}
      />
      <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-faint">hostname</div>
          {app.url ? (
            <a href={app.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-[13px] text-dim underline underline-offset-4">
              {app.url.replace(/^https?:\/\//, "")} ↗
            </a>
          ) : <span className="mt-2 block text-[13px] text-muted">Not deployed yet</span>}
        </div>
        <StatusBadge state={app.state} />
      </Panel>

      <section className="mt-12">
        <Rule label="deployment history" right={`${revisions.length} retained`} />
        <Panel className="divide-y divide-line">
          {historyError ? <p className="p-5 text-[12px] text-muted">History is unavailable. Try reloading.</p> : null}
          {!historyError && revisions.length === 0 ? <p className="p-5 text-[12px] text-muted">No deployment yet.</p> : null}
          {revisions.map((revision) => (
            <div key={revision.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <Link href={`/apps/${id}?deployment=${revision.id}`} className="text-[12px] text-dim hover:underline">
                  {revision.id.slice(0, 12)}
                </Link>
                <span className="ml-3 text-[10px] text-faint">{revision.current ? "current" : "previous"}</span>
                <div className="mt-1 text-[10px] text-muted">{exact(revision.createdAt)}</div>
              </div>
              {!revision.current ? <RollbackButton appId={id} revision={revision.id} /> : null}
            </div>
          ))}
        </Panel>
      </section>

      <section className="mt-12">
        <Rule label="console logs" right={selected ? selected.id.slice(0, 12) : "no deployment"} />
        <Panel className="p-5">
          {logsError ? <p className="text-[12px] text-muted">Logs are unavailable. Try reloading.</p> : (
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-dim">{logText || "No console output recorded yet."}</pre>
          )}
        </Panel>
      </section>
    </>
  );
}
