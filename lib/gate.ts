import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser, type User } from "@clerk/nextjs/server";
import { keyFor, type StoredKey } from "@/lib/keys";
import { domainAllowed, pilotOpen, pilotStatus, type PilotStatus } from "@/lib/pilot";

/**
 * Closed-pilot enforcement, run from the console layout so every page behind it
 * is gated by construction.
 *
 * Nothing here writes to Clerk. Approval by allowlisted domain is *derived*
 * from the email on every request rather than persisted — it is a string
 * comparison, and a render that mutates state re-runs on every refresh, which
 * is how this hit Clerk's rate limit the first time around. Only redeeming an
 * invite writes, and that happens in a server action.
 */

export type PilotUser = {
  userId: string;
  email: string | null;
  name: string | null;
  status: PilotStatus;
  key: StoredKey;
};

/** One Clerk round trip per request, shared by the layout and the page. */
const loadUser = cache(async (): Promise<User | null> => currentUser());

export async function approve(userId: string, via: "domain" | "invite"): Promise<PilotStatus> {
  const status: PilotStatus = { approved: true, via, at: new Date().toISOString() };
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, { publicMetadata: { pilot: status } });
  return status;
}

/** The signed-in user plus their pilot state. Redirects if signed out. */
export async function requireUser(): Promise<PilotUser> {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) redirectToSignIn();

  const user = await loadUser();
  if (!user) redirectToSignIn();

  const email = user!.primaryEmailAddress?.emailAddress ?? null;
  const stored = pilotStatus(user!.publicMetadata);
  const status: PilotStatus = stored.approved
    ? stored
    : pilotOpen()
      ? { approved: true, via: "open" }
      : domainAllowed(email)
      ? { approved: true, via: "domain" }
      : { approved: false };

  return {
    userId: user!.id,
    email,
    name: user!.firstName ?? user!.username ?? null,
    status,
    key: keyFor(user!),
  };
}

/** As `requireUser`, but also sends unapproved users to the invite screen. */
export async function requirePilot(): Promise<PilotUser> {
  const user = await requireUser();
  if (!user.status.approved) redirect("/welcome");
  return user;
}
