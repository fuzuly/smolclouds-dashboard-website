import type { Metadata } from "next";
import Link from "next/link";
import { DeploymentList, type DeploymentRow } from "@/components/DeploymentList";
import { FirstDeploy } from "@/components/FirstDeploy";
import { Diagnostic, PageHeader } from "@/components/ui";
import { requirePilot } from "@/lib/gate";
import { listDeployments, RouterError, type Deployment } from "@/lib/router";
import { site } from "@/lib/site";
import { ago, exact } from "@/lib/time";

export const metadata: Metadata = { title: "Apps" };
export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const user = await requirePilot();
  const key = user.key;

  let deployments: Deployment[] = [];
  let failure: string | null = null;

  try {
    deployments = await listDeployments(key.token);
  } catch (error) {
    failure =
      error instanceof RouterError
        ? `It answered ${error.status} for GET /v1/apps.`
        : "It did not answer in time.";
  }

  const awake = deployments.filter((item) => item.state === "awake").length;
  const rows: DeploymentRow[] = deployments.map((deployment) => ({
    ...deployment,
    agoLabel: ago(deployment.lastRequestAt),
    exactLabel: exact(deployment.lastRequestAt),
  }));

  return (
    <>
      <PageHeader
        label="apps"
        title="Your apps"
        description="Every app in this account, with live state for deployed apps. Apps sleep when nothing is calling them and wake on the next request."
        right={
          failure || deployments.length === 0 ? null : (
            <span className="tabular-nums">
              {deployments.length} total · {awake} awake
            </span>
          )
        }
      />

      {failure ? (
        <Diagnostic
          from={site.console}
          to={site.apiBase.replace(/^https?:\/\//, "")}
          title="The console could not reach the router"
          action={
            <Link
              href="/apps"
              className="inline-block border border-text bg-text px-4 py-2 text-[11px] text-bg transition-colors hover:bg-dim"
            >
              try again
            </Link>
          }
        >
          {failure} Apps are read from the server, not your browser, so this is the router
          itself — not a network or CORS problem on this page. Your apps keep running and nothing
          was changed.
        </Diagnostic>
      ) : deployments.length === 0 ? (
        <FirstDeploy />
      ) : (
        <>
          <div className="flex gap-x-6 border-x border-t border-line bg-surface-2 py-2.5 pl-6 pr-5 text-[10px] uppercase tracking-[0.22em] text-ghost">
            <span className="flex-1">app</span>
            <span className="w-[6.5rem]">state</span>
            <span className="w-28 text-right">last request</span>
            <span className="w-24 shrink-0" />
          </div>
          <DeploymentList deployments={rows} />
        </>
      )}
    </>
  );
}
