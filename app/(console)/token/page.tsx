import type { Metadata } from "next";
import Link from "next/link";
import { Command } from "@/components/Copy";
import { TokenPanel } from "@/components/TokenPanel";
import { PageHeader, Panel, Rule } from "@/components/ui";
import { requirePilot } from "@/lib/gate";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Token" };
export const dynamic = "force-dynamic";

export default async function TokenPage() {
  const user = await requirePilot();
  const key = user.key;

  return (
    <>
      <PageHeader
        label="token"
        title="API token"
        description="One token per account. The CLI and anything calling the router directly authenticate with it."
      />

      <TokenPanel token={key.token} createdAt={key.createdAt} />

      <section className="mt-14">
        <Rule label="use it" />
        <div className="space-y-8">
          <div>
            <p className={`mb-3 text-[11px] text-muted`}>From the CLI — it stores the token for you:</p>
            <div className="space-y-2">
              <Command>smolclouds auth</Command>
              <Command>smolclouds deploy .</Command>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] text-muted">
              Or straight over HTTP, as a bearer token:
            </p>
            <Panel className="p-5">
              <pre className="overflow-x-auto text-[13px] leading-relaxed text-dim">
{`curl ${site.apiBase}/deployments \\
  -H "Authorization: Bearer $SMOLCLOUDS_TOKEN"`}
              </pre>
            </Panel>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <Rule label="keep it safe" />
        <p className="max-w-prose text-[11px] leading-relaxed text-muted">
          The token carries your account id, so anything holding it can deploy, read and delete
          your apps. Keep it out of repositories and client-side code — put it in an environment
          variable or your CLI&apos;s stored credentials. If it leaks, rotate it above, update the
          CLI and anything else that uses it, and tell us at {site.support} so we can confirm the
          old token is refused. Nothing that is already deployed goes down.
        </p>
        <p className="mt-4 text-[11px] text-faint">
          Nothing deployed yet?{" "}
          <Link
            href="/apps"
            className="text-muted underline decoration-ghost underline-offset-4 transition-colors hover:text-dim hover:decoration-muted"
          >
            Start from your apps page
          </Link>
          .
        </p>
      </section>
    </>
  );
}
