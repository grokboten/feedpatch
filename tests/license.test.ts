import { describe, expect, it } from "vitest";
import { verifyLicenseKey } from "@/lib/license";
import { DEV_LICENSE_KEY } from "@/lib/types";

describe("verifyLicenseKey", () => {
  it("accepts FEEDPATCH-DEV in development when Gumroad is not configured", async () => {
    const result = await verifyLicenseKey(DEV_LICENSE_KEY, { NODE_ENV: "development" });
    expect(result).toEqual({ ok: true, source: "dev" });
  });

  it("rejects other keys in development without Gumroad", async () => {
    const result = await verifyLicenseKey("NOPE", { NODE_ENV: "development" });
    expect(result.ok).toBe(false);
  });

  it("fails closed in production without a Gumroad token", async () => {
    const result = await verifyLicenseKey(DEV_LICENSE_KEY, { NODE_ENV: "production" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });

  it("verifies against Gumroad when env is present", async () => {
    const fetchImpl = (async () =>
      ({
        json: async () => ({ success: true }),
      }) as Response) as unknown as typeof fetch;
    const result = await verifyLicenseKey(
      "LICENSE-1",
      { NODE_ENV: "production", GUMROAD_PRODUCT_PERMALINK: "feedpatch" },
      fetchImpl,
    );
    expect(result).toEqual({ ok: true, source: "gumroad" });
  });

  it("fails closed when Gumroad says no", async () => {
    const fetchImpl = (async () =>
      ({
        json: async () => ({ success: false, message: "Nope" }),
      }) as Response) as unknown as typeof fetch;
    const result = await verifyLicenseKey(
      "BAD",
      { GUMROAD_ACCESS_TOKEN: "token" },
      fetchImpl,
    );
    expect(result.ok).toBe(false);
  });
});
