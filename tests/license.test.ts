import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { mintSignedKey, verifyLicenseKey } from "@/lib/license";
import { DEV_LICENSE_KEY } from "@/lib/types";

describe("verifyLicenseKey", () => {
  it("accepts FEEDPATCH-DEV in development when Gumroad is not configured", async () => {
    const result = await verifyLicenseKey(DEV_LICENSE_KEY, { NODE_ENV: "development" });
    expect(result).toEqual({ ok: true, source: "dev" });
  });

  it("accepts FEEDPATCH-DEV in production when Gumroad is not configured", async () => {
    const result = await verifyLicenseKey(DEV_LICENSE_KEY, { NODE_ENV: "production" });
    expect(result).toEqual({ ok: true, source: "dev" });
  });

  it("rejects other keys without Gumroad with copy that names the demo key", async () => {
    const result = await verifyLicenseKey("NOPE", { NODE_ENV: "production" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/FEEDPATCH-DEV/);
    expect(result.error).toMatch(/not configured/i);
  });

  it("rejects other keys in development without Gumroad", async () => {
    const result = await verifyLicenseKey("NOPE", { NODE_ENV: "development" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/FEEDPATCH-DEV/);
  });

  it("rejects FEEDPATCH-DEV when Gumroad env is present", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await verifyLicenseKey(
      DEV_LICENSE_KEY,
      { NODE_ENV: "production", GUMROAD_PRODUCT_PERMALINK: "feedpatch" },
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/demo key|Gumroad/i);
    expect(fetchImpl).not.toHaveBeenCalled();
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

  it("accepts an HMAC-signed key when Gumroad is not configured", async () => {
    const key = mintSignedKey("shop-42", { LICENSE_SECRET: "unit-test-secret" });
    expect(key.startsWith("FP1.shop-42.")).toBe(true);
    const result = await verifyLicenseKey(key, {
      NODE_ENV: "production",
      LICENSE_SECRET: "unit-test-secret",
    });
    expect(result).toEqual({ ok: true, source: "signed" });
  });

  it("rejects a signed key with the wrong secret", async () => {
    const key = mintSignedKey("shop-42", { LICENSE_SECRET: "unit-test-secret" });
    const result = await verifyLicenseKey(key, {
      NODE_ENV: "production",
      LICENSE_SECRET: "other-secret",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects signed keys when Gumroad env is present", async () => {
    const key = mintSignedKey("shop-42", { LICENSE_SECRET: "unit-test-secret" });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await verifyLicenseKey(
      key,
      {
        NODE_ENV: "production",
        GUMROAD_ACCESS_TOKEN: "token",
        LICENSE_SECRET: "unit-test-secret",
      },
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("scripts/mint-license.mjs prints a key verifyLicenseKey accepts", async () => {
    const printed = execFileSync("node", ["scripts/mint-license.mjs", "shop-cli"], {
      cwd: resolve(__dirname, ".."),
      encoding: "utf8",
      env: { ...process.env, LICENSE_SECRET: "unit-test-secret" },
    }).trim();
    const result = await verifyLicenseKey(printed, {
      NODE_ENV: "production",
      LICENSE_SECRET: "unit-test-secret",
    });
    expect(result).toEqual({ ok: true, source: "signed" });
  });
});
