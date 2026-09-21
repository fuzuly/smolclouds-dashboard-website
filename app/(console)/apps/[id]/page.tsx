import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppDetail } from "@/components/AppDetail";
import { Diagnostic, PageHeader } from "@/components/ui";
import { requirePilot } from "@/lib/gate";
import { listDeployments, RouterError, type Deployment } from "@/lib/router";
import { site } from "@/lib/site";
import { ago, exact } from "@/lib/time";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: decodeURIComponent(id) };
}

/**
 * One app. The router only lists deployments — there is no single-app
 * endpoint yet — so this reads the list and picks. That is one round trip
 * either way, and it keeps the page honest about what the router actually
 * offers rather than pretending an endpoint into existence.
 */
export default async function AppPage({ params }: Props) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const user = await requirePilot();

  let deployments: Deployment[] = [];
  let failure: string | null = null;

  try {
    deployments = await listDeployments(user.key.token);
  } catch (error) {
    failure =
      error instanceof RouterError
        ? `It answered ${error.status} for GET /deployments.`
        : "It did not answer in time.";
  }

  if (failure) {
    return (
      <>
        <PageHeader label="app" title={id} />
        <Diagnostic
          from={site.console}
          to={site.apiBase.replace(/^https?:\/\//, "")}
          title="The console could not reach the router"
          action={
            <Link
              href={`/apps/${encodeURIComponent(id)}`}
              className="inline-block border border-text bg-text px-4 py-2 text-[11px] text-bg transition-colors hover:bg-dim"
            >
              try again
            </Link>
          }
        >
          {failure} Nothing about the app was changed.
        </Diagnostic>
      </>
    );
  }

  const deployment = deployments.find((item) => item.id === id || item.name === id);
  if (!deployment) notFound();

  return (
    <AppDetail
      deployment={deployment}
      agoLabel={ago(deployment.lastRequestAt)}
      exactLabel={exact(deployment.lastRequestAt)}
      createdLabel={exact(deployment.createdAt)}
    />
  );
}
