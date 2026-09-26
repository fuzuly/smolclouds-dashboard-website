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
  region?: string;
};

export type AppUsage = {
  activeSeconds: number;
  egressBytes: number;
  ingressBytes: number;
  requests: number;
  wakes: number;
};

export type AppRevision = { id: string; createdAt: string; current: boolean };
export type AppLogs = { deployment: string; text: string };

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

/** Accepts the current `/v1/apps` envelope and the older deployment shape. */
function normalize(body: unknown): Deployment[] {
  const rows = Array.isArray(body)
    ? body
    : ((body as { apps?: unknown[]; deployments?: unknown[] } | null)?.apps ??
      (body as { deployments?: unknown[] } | null)?.deployments ??
      []);

  return (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? row.name ?? ""),
    name: String(row.name ?? row.id ?? "unnamed"),
    url:
      typeof row.url === "string"
        ? row.url
        : typeof row.hostname === "string"
          ? `https://${row.hostname}`
          : undefined,
    state: normalizeState(row.state ?? row.status),
    lastRequestAt: pickDate(row.lastRequestAt ?? row.last_request_at ?? row.lastRequest),
    createdAt: pickDate(row.createdAt ?? row.created_at),
    region: typeof row.region === "string" ? row.region : undefined,
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

function metric(value: unknown, name: string): number {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) {
    throw new Error(`Missing usage field: ${name}`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid usage field: ${name}`);
  }
  return parsed;
}

function normalizeUsage(body: unknown): AppUsage {
  const envelope = body as { usage?: unknown } | null;
  const row = (envelope?.usage ?? body) as Record<string, unknown> | null;

  return {
    activeSeconds: metric(row?.activeSeconds ?? row?.active_seconds, "activeSeconds"),
    egressBytes: metric(row?.egressBytes ?? row?.egress, "egressBytes"),
    ingressBytes: metric(row?.ingressBytes ?? row?.ingress, "ingressBytes"),
    requests: metric(row?.requests, "requests"),
    wakes: metric(row?.wakes, "wakes"),
  };
}

export async function listDeployments(token: string): Promise<Deployment[]> {
  const [appsResponse, activityResponse] = await Promise.all([
    call("/v1/apps", token),
    call("/deployments", token),
  ]);
  const apps = normalize(await appsResponse.json());
  const activity = new Map(normalize(await activityResponse.json()).map((item) => [item.id, item]));
  return apps.map((app) => ({ ...app, ...activity.get(app.id) }));
}

export async function listAppRevisions(token: string, id: string): Promise<AppRevision[]> {
  const response = await call(`/v1/apps/${encodeURIComponent(id)}/deployments`, token);
  const body = (await response.json()) as { deployments?: AppRevision[] };
  if (!Array.isArray(body.deployments)) throw new Error("Invalid deployment history");
  return body.deployments;
}

export async function getAppLogs(token: string, id: string, deployment?: string): Promise<AppLogs> {
  const query = deployment ? `?${new URLSearchParams({ deployment })}` : "";
  const response = await call(`/v1/apps/${encodeURIComponent(id)}/logs${query}`, token);
  return (await response.json()) as AppLogs;
}

export async function rollbackApp(token: string, id: string, deployment: string): Promise<void> {
  await call(`/v1/apps/${encodeURIComponent(id)}/rollback`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deployment }),
  });
}

export async function getAppUsage(
  token: string,
  id: string,
  month?: string,
): Promise<AppUsage> {
  const query = month ? `?${new URLSearchParams({ month })}` : "";
  const response = await call(`/v1/apps/${encodeURIComponent(id)}/usage${query}`, token);
  return normalizeUsage(await response.json());
}

export async function deleteDeployment(token: string, id: string): Promise<void> {
  await call(`/v1/apps/${encodeURIComponent(id)}`, token, { method: "DELETE" });
}
