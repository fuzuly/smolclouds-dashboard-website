import { beforeAll, describe, expect, it } from "vitest";
import { maskToken, mintToken, newKeyId, verifyToken } from "@/lib/token";

/**
 * The token is the one thing here a customer's security actually depends on:
 * anything holding it can deploy, read and delete their apps. So its mint,
 * verify and rotate behaviour is pinned rather than trusted.
 */
beforeAll(() => {
  process.env.SMOLCLOUDS_TOKEN_SECRET = "test-secret-do-not-use-in-production";
});

describe("mintToken", () => {
  it("issues a token the verifier accepts, carrying the user and key id", () => {
    const { token, keyId } = mintToken("user_abc");
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.u).toBe("user_abc");
    expect(payload!.k).toBe(keyId);
  });

  it("is deterministic for the same user, key id and issue time", () => {
    // This is what lets the first token exist without being written anywhere:
    // the console re-derives it on every render and gets the same string.
    const a = mintToken("user_abc", "0", 1_700_000_000);
    const b = mintToken("user_abc", "0", 1_700_000_000);
    expect(a.token).toBe(b.token);
  });

  it("changes when the key id changes, so a rotated token is distinguishable", () => {
    const before = mintToken("user_abc", "0", 1_700_000_000);
    const after = mintToken("user_abc", newKeyId(), 1_700_000_000);
    expect(after.token).not.toBe(before.token);
    expect(verifyToken(before.token)!.k).not.toBe(verifyToken(after.token)!.k);
  });

  it("carries the sc_live_ prefix the CLI and the router look for", () => {
    expect(mintToken("user_abc").token.startsWith("sc_live_")).toBe(true);
  });
});

describe("verifyToken", () => {
  it("rejects a token signed with a different secret", () => {
    const { token } = mintToken("user_abc");
    process.env.SMOLCLOUDS_TOKEN_SECRET = "a-different-secret";
    expect(verifyToken(token)).toBeNull();
    process.env.SMOLCLOUDS_TOKEN_SECRET = "test-secret-do-not-use-in-production";
  });

  it("rejects a token whose payload was edited after signing", () => {
    // Swap the user id inside the body: the signature no longer matches, so a
    // holder cannot promote themselves to another account.
    const { token } = mintToken("user_abc");
    const [body, sig] = token.slice("sc_live_".length).split(".");
    const tampered = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), u: "user_xyz" }),
    ).toString("base64url");
    expect(verifyToken(`sc_live_${tampered}.${sig}`)).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    for (const bad of ["", "sc_live_", "sc_live_nodot", "not-a-token", "sc_live_a.b.c"]) {
      expect(verifyToken(bad)).toBeNull();
    }
  });

  it("rejects a valid-looking token with a truncated signature", () => {
    const { token } = mintToken("user_abc");
    expect(verifyToken(token.slice(0, -4))).toBeNull();
  });
});

describe("maskToken", () => {
  it("shows the prefix and a short tail, never the middle", () => {
    const { token } = mintToken("user_abc");
    const masked = maskToken(token);
    expect(masked.startsWith("sc_live_")).toBe(true);
    expect(masked.endsWith(token.slice(-4))).toBe(true);
    expect(masked.length).toBeLessThan(token.length / 2);
    expect(masked).toContain("…");
  });
});

describe("newKeyId", () => {
  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newKeyId()));
    expect(ids.size).toBe(200);
  });
});
