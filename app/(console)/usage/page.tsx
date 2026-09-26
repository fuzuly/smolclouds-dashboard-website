import type { Metadata } from "next";
import Link from "next/link";
import {
  BarRow,
  Diagnostic,
  Meter,
  PageHeader,
  Panel,
  Rule,
  Stat,
  StatusBadge,
} from "@/components/ui";
import { requirePilot } from "@/lib/gate";
import { getAppUsage, listDeployments, type AppUsage, type Deployment } from "@/lib/router";
import { site } from "@/lib/site";
import { ago, exact } from "@/lib/time";

export const metadata: Metadata = { title: "Usage" };
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BYTE = 1024;
const COUNT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type UsageRow = {
  deployment: Deployment;
  usage: AppUsage | null;
};

function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)} h`;
}

function formatBytes(bytes: number): string {
  const gigabytes = bytes / BYTE ** 3;
  if (gigabytes >= 1) return `${gigabytes.toFixed(1)} GB`;
  return `${(bytes / BYTE ** 2).toFixed(1)} MB`;
}

function formatCount(value: number): string {
  return COUNT.format(Math.round(value));
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthName(month: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

/** Milliseconds since the app last served a request, or null if it never has. */
function idleFor(deployment: Deployment): number | null {
  if (!deployment.lastRequestAt) return null;
  const at = new Date(deployment.lastRequestAt).getTime();
  return Number.isNaN(at) ? null : Date.now() - at;
}

export default async function UsagePage() {
  const user = await requirePilot();

  let deployments: Deployment[] = [];
  let failed = false;

  try {
    deployments = await listDeployments(user.key.token);
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <>
        <PageHeader label="usage" title="Usage" />
        <Diagnostic
          from={site.console}
          to={site.apiBase.replace(/^https?:\/\//, "")}
          title="The console could not reach the router"
          action={
            <Link
              href="/usage"
              className="inline-block border border-text bg-text px-4 py-2 text-[11px] text-bg transition-colors hover:bg-dim"
            >
              try again
            </Link>
          }
        >
          The app list is the starting point for both metered usage and activity, so every
          number here comes back as soon as the router answers again.
        </Diagnostic>
      </>
    );
  }

  const month = currentMonth();
  const usageRows: UsageRow[] = await Promise.all(
    deployments.map(async (deployment) => {
      try {
        const usage = await getAppUsage(user.key.token, deployment.id, month);
        return { deployment, usage };
      } catch {
        return { deployment, usage: null };
      }
    }),
  );
  const reportedUsage = usageRows.flatMap((row) => (row.usage ? [row.usage] : []));
  const usageFailures = usageRows.length - reportedUsage.length;
  const usageTotals = reportedUsage.reduce(
    (total, usage) => ({
      activeSeconds: total.activeSeconds + usage.activeSeconds,
      egressBytes: total.egressBytes + usage.egressBytes,
      requests: total.requests + usage.requests,
    }),
    { activeSeconds: 0, egressBytes: 0, requests: 0 },
  );
  const hasReportedUsage = reportedUsage.length > 0;

  const awake = deployments.filter((item) => item.state === "awake").length;
  const idle = deployments.map(idleFor);

  const activeToday = idle.filter((age) => age !== null && age < DAY).length;
  const buckets = [
    { label: "last hour", value: idle.filter((age) => age !== null && age < HOUR).length },
    {
      label: "1 – 24 hours",
      value: idle.filter((age) => age !== null && age >= HOUR && age < DAY).length,
    },
    {
      label: "1 – 7 days",
      value: idle.filter((age) => age !== null && age >= DAY && age < 7 * DAY).length,
    },
    {
      label: "older / never",
      value: idle.filter((age) => age === null || age >= 7 * DAY).length,
    },
  ];

  const recent = [...deployments]
    .filter((item) => item.lastRequestAt)
    .sort((a, b) => (idleFor(a) ?? Infinity) - (idleFor(b) ?? Infinity))
    .slice(0, 6);

  return (
    <>
      <PageHeader
        label="usage"
        title="Usage"
        description="Metered consumption for this month, followed by what this account is running right now. The closed pilot is not billed."
        right={<span>closed pilot</span>}
      />

      {deployments.length === 0 ? (
        <Panel className="p-10 text-center">
          <p className="text-[13px] text-dim">Nothing deployed yet</p>
          <p className="mx-auto mt-3 max-w-sm text-[11px] leading-relaxed text-muted">
            Usage starts counting with your first app.{" "}
            <Link
              href="/apps"
              className="text-dim underline decoration-ghost underline-offset-4 transition-colors hover:decoration-muted"
            >
              Deploy one
            </Link>{" "}
            — it takes three commands.
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid gap-px bg-line sm:grid-cols-3">
            <Stat
              value={hasReportedUsage ? formatHours(usageTotals.activeSeconds) : "—"}
              label="active time"
              note={`${monthName(month)} across ${reportedUsage.length} of ${deployments.length} apps`}
            />
            <Stat
              value={hasReportedUsage ? formatBytes(usageTotals.egressBytes) : "—"}
              label="egress"
              note="outbound traffic this month"
            />
            <Stat
              value={hasReportedUsage ? formatCount(usageTotals.requests) : "—"}
              label="requests"
              note="served this month"
            />
          </div>

          <section className="mt-14">
            <Rule
              label="metered by app"
              right={`${monthName(month)} · ${reportedUsage.length}/${deployments.length} reporting`}
            />
            <Panel className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left">
                <thead className="border-b border-line bg-surface-2 text-[10px] uppercase tracking-[0.18em] text-ghost">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-normal">
                      app
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-normal">
                      active
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-normal">
                      egress
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-normal">
                      requests
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-normal">
                      wakes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usageRows.map(({ deployment, usage }) => (
                    <tr key={deployment.id} className="border-b border-line last:border-b-0">
                      <th scope="row" className="px-5 py-4 text-[13px] font-normal text-dim">
                        <span className="block max-w-64 truncate">{deployment.name}</span>
                        {!usage ? (
                          <span className="mt-1 block text-[10px] text-faint">usage unavailable</span>
                        ) : null}
                      </th>
                      <td className="px-5 py-4 text-right text-[12px] tabular-nums text-muted">
                        {usage ? formatHours(usage.activeSeconds) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right text-[12px] tabular-nums text-muted">
                        {usage ? formatBytes(usage.egressBytes) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right text-[12px] tabular-nums text-muted">
                        {usage ? formatCount(usage.requests) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right text-[12px] tabular-nums text-muted">
                        {usage ? formatCount(usage.wakes) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            {usageFailures > 0 ? (
              <p className="mt-3 text-[11px] leading-relaxed text-faint">
                {usageFailures} {usageFailures === 1 ? "app is" : "apps are"} missing from the
                totals because the router did not return usage for them.
              </p>
            ) : null}
          </section>

          <section className="mt-14">
            <Rule label="activity snapshot" />
            <div className="grid gap-px bg-line sm:grid-cols-3">
              <Stat value={deployments.length} label="apps" note="deployed to this account" />
              <Stat value={awake} label="awake now" note="running, using active compute" />
              <Stat
                value={activeToday}
                label="active today"
                note="served a request in the last 24 hours"
              />
            </div>
          </section>

          <section className="mt-14 grid gap-12 md:grid-cols-2">
            <div>
              <Rule label="awake right now" />
              <Meter
                value={awake}
                total={deployments.length}
                label="awake"
                caption="A sleeping app uses no active compute. It still holds its storage, snapshot and routing, and wakes on the next request."
              />
            </div>

            <div>
              <Rule label="last request" />
              <BarRow rows={buckets} />
            </div>
          </section>

          {recent.length > 0 ? (
            <section className="mt-14">
              <Rule label="most recently used" />
              <Panel>
                {recent.map((deployment) => (
                  <div
                    key={deployment.id}
                    className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-5 py-4 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-dim">
                      {deployment.name}
                    </span>
                    <StatusBadge state={deployment.state} />
                    <span
                      className="w-28 text-right text-[11px] tabular-nums text-muted"
                      title={exact(deployment.lastRequestAt)}
                    >
                      {ago(deployment.lastRequestAt)}
                    </span>
                  </div>
                ))}
              </Panel>
            </section>
          ) : null}
        </>
      )}

      <p className="mt-14 text-[11px] text-faint">signed in as {user.email ?? user.userId}</p>
    </>
  );
}
