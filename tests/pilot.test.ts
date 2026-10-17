import { afterEach, describe, expect, it } from "vitest";
import { domainAllowed, inviteCodeValid, pilotOpen, pilotStatus } from "@/lib/pilot";

/**
 * The gate decides who gets into the console at all. The failure worth pinning
 * is the quiet one: an allowlist entry that stops matching because of case or
 * whitespace, which locks out exactly the people it was meant to admit.
 */
const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("domainAllowed", () => {
  it("admits an email whose domain is on the list, case-insensitively", () => {
    process.env.PILOT_ALLOWED_DOMAINS = "pulsaraai.com, Example.org";
    expect(domainAllowed("doganay.alpay@pulsaraai.com")).toBe(true);
    expect(domainAllowed("Someone@PULSARAAI.COM")).toBe(true);
    expect(domainAllowed("x@example.org")).toBe(true);
  });

  it("refuses a domain that is not listed, a missing email, and a lookalike", () => {
    process.env.PILOT_ALLOWED_DOMAINS = "pulsaraai.com";
    expect(domainAllowed("x@gmail.com")).toBe(false);
    expect(domainAllowed(null)).toBe(false);
    expect(domainAllowed(undefined)).toBe(false);
    // Subdomain and suffix tricks must not pass: the comparison is exact.
    expect(domainAllowed("x@evil.pulsaraai.com")).toBe(false);
    expect(domainAllowed("x@pulsaraai.com.evil")).toBe(false);
  });

  it("refuses everyone when the list is empty", () => {
    process.env.PILOT_ALLOWED_DOMAINS = "";
    expect(domainAllowed("x@pulsaraai.com")).toBe(false);
  });
});

describe("inviteCodeValid", () => {
  it("matches codes case-insensitively and ignores surrounding whitespace", () => {
    process.env.PILOT_INVITE_CODES = "alpha-1, Beta-2";
    expect(inviteCodeValid("alpha-1")).toBe(true);
    expect(inviteCodeValid("  ALPHA-1 ")).toBe(true);
    expect(inviteCodeValid("beta-2")).toBe(true);
    expect(inviteCodeValid("gamma-3")).toBe(false);
    expect(inviteCodeValid("")).toBe(false);
  });
});

describe("pilotOpen", () => {
  it("is only true for the literal string true", () => {
    process.env.PILOT_OPEN = "true";
    expect(pilotOpen()).toBe(true);
    process.env.PILOT_OPEN = " TRUE ";
    expect(pilotOpen()).toBe(true);
    for (const value of ["1", "yes", "false", "", undefined]) {
      if (value === undefined) delete process.env.PILOT_OPEN;
      else process.env.PILOT_OPEN = value;
      expect(pilotOpen(), `PILOT_OPEN=${value}`).toBe(false);
    }
  });
});

describe("pilotStatus", () => {
  it("reads an approval off metadata and treats anything else as not approved", () => {
    expect(pilotStatus({ pilot: { approved: true, via: "invite" } }).approved).toBe(true);
    expect(pilotStatus({ pilot: { approved: false } }).approved).toBe(false);
    expect(pilotStatus({}).approved).toBe(false);
    expect(pilotStatus(null).approved).toBe(false);
    expect(pilotStatus(undefined).approved).toBe(false);
    expect(pilotStatus("garbage").approved).toBe(false);
  });
});
