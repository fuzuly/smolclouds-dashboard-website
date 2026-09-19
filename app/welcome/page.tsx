import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { AuthFrame } from "@/components/AuthFrame";
import { CliInstallCommands } from "@/components/CliInstallCommands";
import { Command } from "@/components/Copy";
import { InviteForm } from "@/components/InviteForm";
import { Step } from "@/components/ui";
import { requireUser } from "@/lib/gate";
import { allowedDomains } from "@/lib/pilot";

export const metadata: Metadata = { title: "Invite" };
export const dynamic = "force-dynamic";

/**
 * The gate and the onboarding are the same screen: someone who has just signed
 * up should be able to see the whole path to a running app, not only the door
 * they are standing at.
 */
export default async function WelcomePage() {
  const user = await requireUser();
  if (user.status.approved) redirect("/apps");

  const domains = allowedDomains();

  return (
    <AuthFrame
      wide
      title="closed pilot"
      caption={`Signed in as ${user.email ?? user.userId}. Four steps to your first running app — you are on the second.`}
      footer={
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <SignOutButton>
            <button
              type="button"
              className="underline decoration-ghost underline-offset-4 transition-colors hover:text-muted hover:decoration-muted"
            >
              sign out
            </button>
          </SignOutButton>
          <a
            href="mailto:support@smolclouds.com?subject=Pilot%20access"
            className="underline decoration-ghost underline-offset-4 transition-colors hover:text-muted hover:decoration-muted"
          >
            ask for an invite
          </a>
        </span>
      }
    >
      <ol className="[&>li:last-child>div]:pb-0">
        <Step n={1} title="Account created" state="done" />

        <Step n={2} title="Redeem your invite code" state="current">
          <InviteForm />
          {domains.length > 0 ? (
            <p className="mt-4 text-[11px] leading-relaxed text-faint">
              Accounts on {domains.map((domain) => `@${domain}`).join(", ")} are admitted without a
              code — sign in with that address instead.
            </p>
          ) : null}
        </Step>

        <Step n={3} title="Copy your API token">
          <p className="text-[11px] leading-relaxed text-muted">
            One token per account, on the token page. The CLI stores it for you.
          </p>
        </Step>

        <Step n={4} title="Install the CLI and deploy">
          <div className="space-y-3">
            <CliInstallCommands />
            <Command>smolclouds deploy .</Command>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            The app gets a URL, then sleeps on its own when traffic stops and wakes on the next
            request.
          </p>
        </Step>
      </ol>
    </AuthFrame>
  );
}
