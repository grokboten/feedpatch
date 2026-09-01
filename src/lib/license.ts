import { createHmac, timingSafeEqual } from "node:crypto";
import { DEV_LICENSE_KEY } from "./types";

export type LicenseResult = {
  ok: boolean;
  source?: "dev" | "signed" | "gumroad";
  error?: string;
};

/** Hobby-demo fallback only. Override with LICENSE_SECRET in real deploys. Keep in sync with scripts/mint-license.mjs. */
export const HOBBY_LICENSE_SECRET = "feedpatch-hobby-demo-do-not-use-in-commerce-v1";

const SIGNED_KEY = /^FP1\.([A-Za-z0-9_-]+)\.([a-f0-9]{20})$/i;

export function licenseSecret(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = (env.LICENSE_SECRET || "").trim();
  return fromEnv || HOBBY_LICENSE_SECRET;
}

export function signNonce(nonce: string, secret: string): string {
  return createHmac("sha256", secret).update("fp1:" + nonce, "utf8").digest("hex").slice(0, 20);
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase(), "utf8");
  const right = Buffer.from(b.toLowerCase(), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function mintSignedKey(nonce: string, env: NodeJS.ProcessEnv = process.env): string {
  const n = (nonce || "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(n)) {
    throw new Error("nonce must match [A-Za-z0-9_-]+");
  }
  return "FP1." + n + "." + signNonce(n, licenseSecret(env));
}

export function verifySignedKey(key: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const m = SIGNED_KEY.exec((key || "").trim());
  if (!m) return false;
  const expected = signNonce(m[1], licenseSecret(env));
  return safeEqualHex(m[2], expected);
}

export function gumroadConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.GUMROAD_ACCESS_TOKEN || env.GUMROAD_PRODUCT_PERMALINK || env.GUMROAD_PRODUCT_ID,
  );
}

const MISSING_CONFIG_COPY =
  `That key was not accepted. License verification is not configured on this deployment, so paid Gumroad keys cannot be checked. Use the demo license key ${DEV_LICENSE_KEY} to unlock paid exports here, or wire GUMROAD_ACCESS_TOKEN / GUMROAD_PRODUCT_PERMALINK to verify real licenses.`;

const DEV_KEY_REJECTED_COPY =
  `${DEV_LICENSE_KEY} is the demo license key and is rejected when Gumroad verification is enabled. Paste a real Gumroad license key.`;

const SIGNED_KEY_REJECTED_COPY =
  "Signed hobby keys are rejected when Gumroad verification is enabled. Paste a real Gumroad license key.";

/**
 * License gate:
 * - No Gumroad env: accept FEEDPATCH-DEV (incl. production) and HMAC-signed FP1 keys.
 * - Gumroad env present: reject demo/signed keys; verify real keys against Gumroad.
 * - Never invent a token.
 */
export async function verifyLicenseKey(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<LicenseResult> {
  const trimmed = (key ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "License key is required" };
  }

  if (!gumroadConfigured(env)) {
    if (trimmed === DEV_LICENSE_KEY) {
      return { ok: true, source: "dev" };
    }
    if (verifySignedKey(trimmed, env)) {
      return { ok: true, source: "signed" };
    }
    return { ok: false, error: MISSING_CONFIG_COPY };
  }

  if (trimmed === DEV_LICENSE_KEY) {
    return { ok: false, error: DEV_KEY_REJECTED_COPY };
  }
  if (SIGNED_KEY.test(trimmed)) {
    return { ok: false, error: SIGNED_KEY_REJECTED_COPY };
  }

  const product = env.GUMROAD_PRODUCT_PERMALINK || env.GUMROAD_PRODUCT_ID || "";
  const body = new URLSearchParams({
    license_key: trimmed,
    increment_uses_count: "false",
  });
  if (product) body.set("product_id", product);

  try {
    const res = await fetchImpl("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean; message?: string };
    if (data && data.success) return { ok: true, source: "gumroad" };
    return { ok: false, error: data?.message || "Invalid license key" };
  } catch {
    return { ok: false, error: "Could not reach Gumroad" };
  }
}
