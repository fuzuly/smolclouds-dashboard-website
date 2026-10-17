import { afterEach, describe, expect, it, vi } from "vitest";
import { explainAction, explainFailure, REFUSALS, refusalFor } from "@/lib/errors";
import { deleteDeployment, RouterError } from "@/lib/router";

/**
 * A refusal code is the router saying "no, and here is why". These pin that
 * the console reads the code out of every body shape the router might use,
 * never mistakes a sentence for a code, and falls back to the old wording
 * when there is no code — so nothing that worked before reads differently.
 */
function refuse(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

async function rejection(): Promise<unknown> {
  try {
    await deleteDeployment("tok", "a");
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to fail");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RouterError.code", () => {
  it("reads the code from { code }, { error: code } and { error: { code } }", async () => {
    for (const body of [
      { code: "app_limit_reached" },
      { error: "app_limit_reached" },
      { error: { code: "app_limit_reached", message: "Plan allows 250 apps." } },
    ]) {
      vi.stubGlobal("fetch", refuse(409, body));
      const error = await rejection();
      expect(error).toBeInstanceOf(RouterError);
      expect((error as RouterError).code, JSON.stringify(body)).toBe("app_limit_reached");
      expect((error as RouterError).status).toBe(409);
    }
  });

  it("leaves the code empty for a sentence, a non-JSON body or an empty body", async () => {
    for (const body of [{ error: "Something went wrong" }, "<html>Bad Gateway</html>", ""]) {
      vi.stubGlobal("fetch", refuse(502, body));
      const error = (await rejection()) as RouterError;
      expect(error.status).toBe(502);
      expect(error.code, JSON.stringify(body)).toBeUndefined();
    }
  });
});

describe("REFUSALS", () => {
  it("covers every code documented on the errors page", () => {
    expect(Object.keys(REFUSALS).sort()).toEqual(
      [
        "app_access_denied",
        "app_limit_reached",
        "build_failed",
        "deploys_paused_by_quiet_hours",
        "domain_limit_reached",
        "permission_denied",
        "seat_limit_reached",
        "snapshot_invalidated",
        "spend_cap_reached",
        "wake_failed",
      ].sort(),
    );
  });

  it("marks only snapshot_invalidated and wake_failed as worth retrying", () => {
    const retryable = Object.entries(REFUSALS)
      .filter(([, refusal]) => refusal.retryable)
      .map(([code]) => code)
      .sort();
    expect(retryable).toEqual(["snapshot_invalidated", "wake_failed"]);
  });
});

describe("explainAction", () => {
  it("explains a known code with what to do about it", () => {
    const error = new RouterError("x", 409, "app_limit_reached");
    expect(explainAction(error, "delete")).toBe(
      `${REFUSALS.app_limit_reached.title} ${REFUSALS.app_limit_reached.action}`,
    );
  });

  it("keeps the old wording for an unknown code, no code, or no router", () => {
    expect(explainAction(new RouterError("x", 409, "brand_new_code"), "delete")).toBe(
      "router refused the delete (409)",
    );
    expect(explainAction(new RouterError("x", 500), "rollback")).toBe(
      "router refused the rollback (500)",
    );
    expect(explainAction(new TypeError("fetch failed"), "delete")).toBe(
      "could not reach the router",
    );
  });
});

describe("explainFailure", () => {
  it("explains a known code, otherwise names the status or the timeout", () => {
    expect(explainFailure(new RouterError("x", 403, "permission_denied"), "GET /v1/apps")).toBe(
      `${REFUSALS.permission_denied.title} ${REFUSALS.permission_denied.action}`,
    );
    expect(explainFailure(new RouterError("x", 503), "GET /v1/apps")).toBe(
      "It answered 503 for GET /v1/apps.",
    );
    expect(explainFailure(new Error("timeout"), "GET /v1/apps")).toBe(
      "It did not answer in time.",
    );
  });

  it("refusalFor ignores anything that is not a RouterError", () => {
    expect(refusalFor(new Error("app_limit_reached"))).toBeUndefined();
    expect(refusalFor({ code: "app_limit_reached" })).toBeUndefined();
  });
});
