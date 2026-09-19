import Link from "next/link";
import { Command } from "@/components/Copy";
import { Panel, Step } from "@/components/ui";

/**
 * The empty state carries the onboarding. An account with no apps has exactly
 * one job, so the page is that job rather than a shrug.
 */
export function FirstDeploy() {
  return (
    <Panel className="p-8 sm:p-10">
      <p className="text-[13px] text-dim">No apps yet.</p>
      <p className="mt-2 max-w-prose text-[11px] leading-relaxed text-muted">
        Three commands and the first one is running. Anything that listens on{" "}
        <code className="text-dim">$PORT</code> deploys — a Next.js app, a FastAPI service, a
        single script.
      </p>

      <ol className="mt-9 [&>li:last-child>div]:pb-0">
        <Step n={1} title="Install the CLI" state="current">
          <Command>curl -fsSL https://api.smolclouds.com/install.sh | sh</Command>
        </Step>

        <Step n={2} title="Sign in with your API token" state="current">
          <Command>smolclouds auth</Command>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            It asks for the token on your{" "}
            <Link
              href="/token"
              className="text-dim underline decoration-ghost underline-offset-4 transition-colors hover:decoration-muted"
            >
              token page
            </Link>
            .
          </p>
        </Step>

        <Step n={3} title="Deploy from the project directory" state="current">
          <Command>smolclouds deploy .</Command>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            The app appears here with a URL. It sleeps on its own once traffic stops — no active
            compute while it does — and wakes on the next request.
          </p>
        </Step>
      </ol>
    </Panel>
  );
}
