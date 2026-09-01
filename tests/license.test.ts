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

  it("rejects FEEDPATCH-DEV when POLAR_ORGANIZATION_ID is set", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await verifyLicenseKey(
      DEV_LICENSE_KEY,
      { NODE_ENV: "production", POLAR_ORGANIZATION_ID: "org-polar-1" },
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Polar/i);
    expect(result.error).toMatch(/demo/i);
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

  it("accepts a Polar license key when status is granted", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(String(init?.headers && (init.headers as Record<string, string>)["Content-Type"])).toBe(
        "application/json",
      );
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({ key: "POLAR-KEY-1", organization_id: "org-polar-1" });
      return {
        status: 200,
        json: async () => ({
          id: "lk-1",
          status: "granted",
          benefit_id: "ben-1",
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const result = await verifyLicenseKey(
      "POLAR-KEY-1",
      { POLAR_ORGANIZATION_ID: "org-polar-1" },
      fetchImpl,
    );
    expect(result).toEqual({ ok: true, source: "polar" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects Polar key on 404 when Gumroad is not configured", async () => {
    const fetchImpl = vi.fn(async () =>
      ({
        status: 404,
        json: async () => ({ detail: "Not found" }),
      }) as Response,
    ) as unknown as typeof fetch;

    const result = await verifyLicenseKey(
      "MISSING",
      { POLAR_ORGANIZATION_ID: "org-polar-1" },
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Invalid license key/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls through to Gumroad when Polar returns 404", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes("polar.sh")) {
        return { status: 404, json: async () => ({}) } as Response;
      }
      return {
        status: 200,
        json: async () => ({ success: true }),
      } as Response;
    }) as unknown as typeof fetch;

    const result = await verifyLicenseKey(
      "GUMROAD-KEY",
      {
        POLAR_ORGANIZATION_ID: "org-polar-1",
        GUMROAD_PRODUCT_PERMALINK: "feedpatch",
      },
      fetchImpl,
    );
    expect(result).toEqual({ ok: true, source: "gumroad" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects Polar key when benefit_id does not match POLAR_BENEFIT_ID", async () => {
    const fetchImpl = vi.fn(async () =>
      ({
        status: 200,
        json: async () => ({
          id: "lk-1",
          status: "granted",
          benefit_id: "other-benefit",
        }),
      }) as Response,
    ) as unknown as typeof fetch;

    const result = await verifyLicenseKey(
      "POLAR-KEY-1",
      {
        POLAR_ORGANIZATION_ID: "org-polar-1",
        POLAR_BENEFIT_ID: "expected-benefit",
      },
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/benefit/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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
