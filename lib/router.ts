import { site } from "@/lib/site";

/**
 * Server-side client for the SmolClouds router. Every call is made from the
 * Next.js server, never the browser: the API token stays out of client code
 * and the console does not depend on api.smolclouds.com sending CORS headers.
 */

export type Deployment = {
  id: string;
  name: string;
  url?: string;
  /** "awake" while a machine is running, "asleep" once it has been suspended. */
  state: "awake" | "asleep" | "starting" | "error" | "unknown";
  lastRequestAt?: string;
  createdAt?: string;
};

export class RouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RouterError";
  }
}

async function call(path: string, token: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${site.apiBase}${path}`, {
    ...init,
    // Without this a router that is down (or not yet deployed) holds the page
    // open for the full connect timeout.
    signal: init?.signal ?? AbortSignal.timeout(6000),
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new RouterError(
      `${init?.method ?? "GET"} ${path} failed: ${response.status} ${response.statusText}`,
      response.status,
    );
  }
  return response;
}

/** Accepts either a bare array or `{ deployments: [...] }` from the router. */
function normalize(body: unknown): Deployment[] {
  const rows = Array.isArray(body)
    ? body
    : ((body as { deployments?: unknown[] } | null)?.deployments ?? []);

  return (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? row.name ?? ""),
    name: String(row.name ?? row.id ?? "unnamed"),
    url: typeof row.url === "string" ? row.url : undefined,
    state: normalizeState(row.state ?? row.status),
    lastRequestAt: pickDate(row.lastRequestAt ?? row.last_request_at ?? row.lastRequest),
    createdAt: pickDate(row.createdAt ?? row.created_at),
  }));
}

function normalizeState(value: unknown): Deployment["state"] {
  const state = String(value ?? "").toLowerCase();
  if (["awake", "running", "active", "up"].includes(state)) return "awake";
  if (["asleep", "sleeping", "suspended", "idle", "stopped"].includes(state)) return "asleep";
  if (["starting", "waking", "pending", "deploying"].includes(state)) return "starting";
  if (["error", "failed", "crashed"].includes(state)) return "error";
  return "unknown";
}

function pickDate(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value * (value > 1e12 ? 1 : 1000)).toISOString();
  return undefined;
}

export async function listDeployments(token: string): Promise<Deployment[]> {
  const response = await call("/deployments", token);
  return normalize(await response.json());
}

export async function deleteDeployment(token: string, id: string): Promise<void> {
  await call(`/deployments/${encodeURIComponent(id)}`, token, { method: "DELETE" });
}
