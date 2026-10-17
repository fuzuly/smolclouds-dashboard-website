import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteDeployment,
  getAppLogs,
  getAppUsage,
  listAppRevisions,
  listDeployments,
  rollbackApp,
  RouterError,
} from "@/lib/router";

/**
 * The router client is the only thing standing between a page and a router
 * that answers in a slightly different shape than expected. These pin the
 * shapes it promises to accept, so a router change breaks a test before it
 * breaks a page.
 */
type Reply = { status?: number; body: unknown } | "network-error";

/** A fetch that answers by path, and records every call. */
function router(routes: Record<string, Reply>) {
  return vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    const path = new URL(url).pathname;
    const reply = routes[path];
    if (!reply) throw new Error(`unexpected request to ${path}`);
    if (reply === "network-error") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
}

/** The app list with no activity on top. */
function apps(body: unknown) {
  return router({ "/v1/apps": { body }, "/deployments": { body: [] } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listDeployments", () => {
  it("accepts the { apps: [...] } envelope", async () => {
    vi.stubGlobal("fetch", apps({ apps: [{ id: "a", name: "alpha", state: "awake" }] }));
    const rows = await listDeployments("tok");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "a", name: "alpha", state: "awake" });
  });

  it("accepts a bare array and the older { deployments: [...] } envelope", async () => {
    vi.stubGlobal("fetch", apps([{ id: "a", name: "alpha" }]));
    expect(await listDeployments("tok")).toHaveLength(1);

    vi.stubGlobal("fetch", apps({ deployments: [{ id: "a", name: "alpha" }] }));
    expect(await listDeployments("tok")).toHaveLength(1);
  });

  it("builds the URL from hostname when there is no url", async () => {
    vi.stubGlobal("fetch", apps({ apps: [{ id: "a", name: "alpha", hostname: "alpha.smolclouds.com" }] }));
    const [row] = await listDeployments("tok");
    expect(row.url).toBe("https://alpha.smolclouds.com");
  });

  it("maps every documented state spelling, and unknown ones to unknown", async () => {
    const spellings: [string, string][] = [
      ["running", "awake"],
      ["active", "awake"],
      ["up", "awake"],
      ["sleeping", "asleep"],
      ["suspended", "asleep"],
      ["idle", "asleep"],
      ["stopped", "asleep"],
      ["waking", "starting"],
      ["pending", "starting"],
      ["deploying", "starting"],
      ["failed", "error"],
      ["crashed", "error"],
      ["RUNNING", "awake"],
      ["something-new", "unknown"],
    ];
    vi.stubGlobal(
      "fetch",
      apps(spellings.map(([state], i) => ({ id: String(i), name: String(i), state }))),
    );
    const rows = await listDeployments("tok");
    spellings.forEach(([spelling, expected], i) => {
      expect(rows[i].state, `"${spelling}" should map to ${expected}`).toBe(expected);
    });
  });

  it("reads status as an alias for state, and snake_case dates", async () => {
    vi.stubGlobal(
      "fetch",
      apps([
        {
          id: "a",
          name: "alpha",
          status: "running",
          last_request_at: "2026-09-20T10:00:00Z",
          created_at: "2026-09-01T00:00:00Z",
        },
      ]),
    );
    const [row] = await listDeployments("tok");
    expect(row.state).toBe("awake");
    expect(row.lastRequestAt).toBe("2026-09-20T10:00:00Z");
    expect(row.createdAt).toBe("2026-09-01T00:00:00Z");
  });

  it("converts epoch seconds and epoch milliseconds to ISO", async () => {
    // Derived, not hand-typed: a typed epoch is exactly the kind of constant
    // that is one year off and nobody notices.
    const iso = "2026-09-20T10:00:00.000Z";
    const ms = new Date(iso).getTime();
    vi.stubGlobal(
      "fetch",
      apps([
        { id: "s", name: "s", last_request_at: ms / 1000 },
        { id: "ms", name: "ms", last_request_at: ms },
      ]),
    );
    const [seconds, millis] = await listDeployments("tok");
    expect(seconds.lastRequestAt).toBe(iso);
    expect(millis.lastRequestAt).toBe(iso);
  });

  it("falls back to the name for a missing id and vice versa", async () => {
    vi.stubGlobal("fetch", apps([{ name: "only-name" }, { id: "only-id" }]));
    const [a, b] = await listDeployments("tok");
    expect(a.id).toBe("only-name");
    expect(b.name).toBe("only-id");
  });

  it("sends the bearer token and never caches", async () => {
    const fetchMock = apps([]);
    vi.stubGlobal("fetch", fetchMock);
    await listDeployments("sc_live_x");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect((init!.headers as Record<string, string>).authorization).toBe("Bearer sc_live_x");
      expect(init!.cache).toBe("no-store");
    }
  });

  it("throws a RouterError carrying the status when /v1/apps fails", async () => {
    vi.stubGlobal(
      "fetch",
      router({ "/v1/apps": { status: 503, body: {} }, "/deployments": { body: [] } }),
    );
    await expect(listDeployments("tok")).rejects.toBeInstanceOf(RouterError);
    await expect(listDeployments("tok")).rejects.toMatchObject({ status: 503 });
  });
});

describe("listDeployments activity merge", () => {
  it("does not let a bare activity row blank the URL, name or state", async () => {
    vi.stubGlobal(
      "fetch",
      router({
        "/v1/apps": {
          body: {
            apps: [
              {
                id: "a1",
                name: "sales",
                hostname: "sales.smolclouds.com",
                state: "asleep",
                created_at: "2026-10-01T00:00:00Z",
              },
            ],
          },
        },
        "/deployments": { body: [{ id: "a1" }] },
      }),
    );
    const [app] = await listDeployments("tok");
    expect(app).toMatchObject({
      name: "sales",
      url: "https://sales.smolclouds.com",
      state: "asleep",
      createdAt: "2026-10-01T00:00:00Z",
    });
  });

  it("takes live state and last request from activity", async () => {
    vi.stubGlobal(
      "fetch",
      router({
        "/v1/apps": { body: { apps: [{ id: "a1", name: "sales", state: "asleep" }] } },
        "/deployments": {
          body: [{ id: "a1", state: "running", last_request_at: "2026-10-18T10:00:00Z" }],
        },
      }),
    );
    const [app] = await listDeployments("tok");
    expect(app.state).toBe("awake");
    expect(app.lastRequestAt).toBe("2026-10-18T10:00:00Z");
  });

  it("still lists apps when /deployments errors or is unreachable", async () => {
    for (const failing of [{ status: 500, body: {} }, "network-error"] as Reply[]) {
      vi.stubGlobal(
        "fetch",
        router({
          "/v1/apps": { body: { apps: [{ id: "a1", name: "sales", state: "awake" }] } },
          "/deployments": failing,
        }),
      );
      const rows = await listDeployments("tok");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: "a1", name: "sales", state: "awake" });
    }
  });
});

describe("getAppUsage", () => {
  const usage = { activeSeconds: 120, egressBytes: 2048, ingressBytes: 512, requests: 17, wakes: 3 };

  it("reads camelCase and snake_case, bare or inside { usage }", async () => {
    vi.stubGlobal("fetch", router({ "/v1/apps/a/usage": { body: usage } }));
    expect(await getAppUsage("tok", "a")).toEqual(usage);

    vi.stubGlobal(
      "fetch",
      router({
        "/v1/apps/a/usage": {
          body: { usage: { active_seconds: 120, egress: 2048, ingress: 512, requests: 17, wakes: 3 } },
        },
      }),
    );
    expect(await getAppUsage("tok", "a")).toEqual(usage);
  });

  it("refuses a missing or negative field instead of showing zero", async () => {
    vi.stubGlobal("fetch", router({ "/v1/apps/a/usage": { body: { ...usage, wakes: undefined } } }));
    await expect(getAppUsage("tok", "a")).rejects.toThrow("wakes");

    vi.stubGlobal("fetch", router({ "/v1/apps/a/usage": { body: { ...usage, requests: -1 } } }));
    await expect(getAppUsage("tok", "a")).rejects.toThrow("requests");
  });

  it("passes the month as a query parameter", async () => {
    const fetchMock = router({ "/v1/apps/a/usage": { body: usage } });
    vi.stubGlobal("fetch", fetchMock);
    await getAppUsage("tok", "a", "2026-10");
    const [url] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.get("month")).toBe("2026-10");
  });
});

describe("listAppRevisions", () => {
  it("returns the deployments array", async () => {
    const deployments = [{ id: "r1", createdAt: "2026-10-01T00:00:00Z", current: true }];
    vi.stubGlobal("fetch", router({ "/v1/apps/a/deployments": { body: { deployments } } }));
    expect(await listAppRevisions("tok", "a")).toEqual(deployments);
  });

  it("rejects a body without a deployments array", async () => {
    vi.stubGlobal("fetch", router({ "/v1/apps/a/deployments": { body: {} } }));
    await expect(listAppRevisions("tok", "a")).rejects.toThrow("Invalid deployment history");
  });
});

describe("getAppLogs", () => {
  it("asks for one deployment's logs when given one", async () => {
    const fetchMock = router({ "/v1/apps/a/logs": { body: { deployment: "r1", text: "ready" } } });
    vi.stubGlobal("fetch", fetchMock);
    expect(await getAppLogs("tok", "a", "r1")).toEqual({ deployment: "r1", text: "ready" });
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("deployment")).toBe("r1");
  });
});

describe("rollbackApp", () => {
  it("POSTs the target deployment as JSON", async () => {
    const fetchMock = router({ "/v1/apps/a/rollback": { body: {} } });
    vi.stubGlobal("fetch", fetchMock);
    await rollbackApp("tok", "a", "r1");
    const [, init] = fetchMock.mock.calls[0];
    expect(init!.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual({ deployment: "r1" });
  });

  it("throws a RouterError when the router refuses", async () => {
    vi.stubGlobal("fetch", router({ "/v1/apps/a/rollback": { status: 409, body: {} } }));
    await expect(rollbackApp("tok", "a", "r1")).rejects.toMatchObject({ status: 409 });
  });
});

describe("deleteDeployment", () => {
  it("issues DELETE to the encoded app id", async () => {
    const fetchMock = router({ "/v1/apps/my%20app%2F1": { body: {} } });
    vi.stubGlobal("fetch", fetchMock);
    await deleteDeployment("tok", "my app/1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.endsWith("/v1/apps/my%20app%2F1")).toBe(true);
    expect(init!.method).toBe("DELETE");
  });
});
