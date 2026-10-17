import { RouterError } from "@/lib/router";

/**
 * The router's refusal codes, as documented at smolclouds.com/docs/reference/errors.
 * A code means the router understood the request and said no for a stated
 * reason, so the console can say what happened and what to do instead of
 * printing a bare status.
 */
export type Refusal = {
  /** What happened, as one sentence. */
  title: string;
  /** What the person can do about it. */
  action: string;
  /** Whether trying again unchanged can succeed. */
  retryable: boolean;
};

export const REFUSALS: Record<string, Refusal> = {
  app_limit_reached: {
    title: "This workspace has reached the number of apps its plan allows.",
    action: "Delete an app you no longer use, or move to a larger plan.",
    retryable: false,
  },
  domain_limit_reached: {
    title: "This workspace has reached the number of custom domains its plan allows.",
    action: "Remove a custom domain you no longer serve, or move to a larger plan.",
    retryable: false,
  },
  seat_limit_reached: {
    title: "This workspace has reached the number of members its plan allows.",
    action: "Remove a member or a pending invitation, or move to a larger plan.",
    retryable: false,
  },
  spend_cap_reached: {
    title: "This workspace has reached its spend cap, so its apps are asleep.",
    action: "Raise the spend cap, or wait for the next billing period.",
    retryable: false,
  },
  deploys_paused_by_quiet_hours: {
    title: "Deployments are paused during this workspace's quiet hours.",
    action: "Wait for the window to end. Running apps keep serving in the meantime.",
    retryable: false,
  },
  permission_denied: {
    title: "This token's role does not allow that action.",
    action: "Use a token with the required role.",
    retryable: false,
  },
  app_access_denied: {
    title: "This app is private and the request carried no valid access key.",
    action: "Send the app's access key as a bearer token.",
    retryable: false,
  },
  snapshot_invalidated: {
    title: "The app's snapshot was discarded because its configuration changed.",
    action: "Nothing to do: the next request builds a new one and is slower than usual.",
    retryable: true,
  },
  wake_failed: {
    title: "The app could not be restored from its snapshot.",
    action: "Try again in a moment. If it keeps failing, check the app's logs.",
    retryable: true,
  },
  build_failed: {
    title: "The deployment did not build. The previous version keeps serving.",
    action: "Read the build log and fix the cause before deploying again.",
    retryable: false,
  },
};

export function refusalFor(error: unknown): Refusal | undefined {
  return error instanceof RouterError && error.code ? REFUSALS[error.code] : undefined;
}

/**
 * A short line for an action the person just tried — delete, rollback — in
 * the console's lowercase voice when the router gave no reason.
 */
export function explainAction(error: unknown, verb: string): string {
  const refusal = refusalFor(error);
  if (refusal) return `${refusal.title} ${refusal.action}`;
  if (error instanceof RouterError) return `router refused the ${verb} (${error.status})`;
  return "could not reach the router";
}

/** The sentence a Diagnostic panel shows when a page could not load its data. */
export function explainFailure(error: unknown, request: string): string {
  const refusal = refusalFor(error);
  if (refusal) return `${refusal.title} ${refusal.action}`;
  if (error instanceof RouterError) return `It answered ${error.status} for ${request}.`;
  return "It did not answer in time.";
}
