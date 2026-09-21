import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDeployment, listDeployments, RouterError } from "@/lib/router";

/**
 * The router client is the only thing standing between a page and a router
 * that answers in a slightly different shape than expected. These pin the
 * shapes it promises to accept — documented in docs/ROUTER_PATCH.md — so a
 * router change breaks a test before it breaks the /apps page.
 */
function respond(body: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listDeployments", () => {
  it("accepts a bare array", async () => {
    vi.stubGlobal("fetch", respond([{ id: "a", name: "alpha", state: "awake" }]));
    const rows = await listDeployments("tok");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "a", name: "alpha", state: "awake" });
  });

  it("accepts the { deployments: [...] } envelope", async () => {
    vi.stubGlobal("fetch", respond({ deployments: [{ id: "a", name: "alpha" }] }));
    const rows = await listDeployments("tok");
    expect(rows).toHaveLength(1);
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
      respond(spellings.map(([state], i) => ({ id: String(i), name: String(i), state }))),
    );
    const rows = await listDeployments("tok");
    spellings.forEach(([spelling, expected], i) => {
      expect(rows[i].state, `"${spelling}" should map to ${expected}`).toBe(expected);
    });
  });

  it("reads status as an alias for state, and snake_case dates", async () => {
    vi.stubGlobal(
      "fetch",
      respond([
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
      respond([
        { id: "s", name: "s", last_request_at: ms / 1000 },
        { id: "ms", name: "ms", last_request_at: ms },
      ]),
    );
    const [seconds, millis] = await listDeployments("tok");
    expect(seconds.lastRequestAt).toBe(iso);
    expect(millis.lastRequestAt).toBe(iso);
  });

  it("falls back to the name for a missing id and vice versa", async () => {
    vi.stubGlobal("fetch", respond([{ name: "only-name" }, { id: "only-id" }]));
    const [a, b] = await listDeployments("tok");
    expect(a.id).toBe("only-name");
    expect(b.name).toBe("only-id");
  });

  it("sends the bearer token and never caches", async () => {
    const fetchMock = respond([]);
    vi.stubGlobal("fetch", fetchMock);
    await listDeployments("sc_live_x");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sc_live_x");
    expect(init.cache).toBe("no-store");
  });

  it("throws a RouterError carrying the status on a non-2xx answer", async () => {
    vi.stubGlobal("fetch", respond({ error: "nope" }, 503));
    await expect(listDeployments("tok")).rejects.toBeInstanceOf(RouterError);
    await expect(listDeployments("tok")).rejects.toMatchObject({ status: 503 });
  });
});

describe("deleteDeployment", () => {
  it("issues DELETE to the encoded id", async () => {
    const fetchMock = respond({});
    vi.stubGlobal("fetch", fetchMock);
    await deleteDeployment("tok", "my app/1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith("/deployments/my%20app%2F1")).toBe(true);
    expect(init.method).toBe("DELETE");
  });
});
