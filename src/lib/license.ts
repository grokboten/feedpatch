import { createHmac, timingSafeEqual } from "node:crypto";
import { DEV_LICENSE_KEY } from "./types";

export type LicenseResult = {
  ok: boolean;
  source?: "dev" | "signed" | "gumroad" | "polar";
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

export function polarConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env.POLAR_ORGANIZATION_ID || "").trim());
}

export function commerceConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return polarConfigured(env) || gumroadConfigured(env);
}

function paidKeyHint(env: NodeJS.ProcessEnv): string {
  const polar = polarConfigured(env);
  const gumroad = gumroadConfigured(env);
  if (polar && gumroad) return "Paste a real Polar or Gumroad license key.";
  if (polar) return "Paste a real Polar license key.";
  return "Paste a real Gumroad license key.";
}

function commerceLabel(env: NodeJS.ProcessEnv): string {
  const polar = polarConfigured(env);
  const gumroad = gumroadConfigured(env);
  if (polar && gumroad) return "Polar/Gumroad";
  if (polar) return "Polar";
  return "Gumroad";
}

const MISSING_CONFIG_COPY =
  `That key was not accepted. License verification is not configured on this deployment, so paid Polar or Gumroad keys cannot be checked. Use the demo license key ${DEV_LICENSE_KEY} to unlock paid exports here, or wire POLAR_ORGANIZATION_ID and/or GUMROAD_ACCESS_TOKEN / GUMROAD_PRODUCT_PERMALINK to verify real licenses.`;

function devKeyRejectedCopy(env: NodeJS.ProcessEnv): string {
  return `${DEV_LICENSE_KEY} is the demo license key and is rejected when ${commerceLabel(env)} verification is enabled. ${paidKeyHint(env)}`;
}

function signedKeyRejectedCopy(env: NodeJS.ProcessEnv): string {
  return `Signed hobby keys are rejected when ${commerceLabel(env)} verification is enabled. ${paidKeyHint(env)}`;
}

type PolarValidateJson = {
  id?: string;
  status?: string;
  benefit_id?: string;
  error?: string;
  detail?: string;
  message?: string;
};

type PolarAttempt =
  | { kind: "ok" }
  | { kind: "not_found" }
  | { kind: "invalid"; error: string }
  | { kind: "network"; error: string };

async function verifyPolarKey(
  key: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<PolarAttempt> {
  const organizationId = (env.POLAR_ORGANIZATION_ID || "").trim();
  const benefitRequired = (env.POLAR_BENEFIT_ID || "").trim();

  try {
    const res = await fetchImpl("https://api.polar.sh/v1/customer-portal/license-keys/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, organization_id: organizationId }),
    });

    if (res.status === 404) {
      return { kind: "not_found" };
    }

    let data: PolarValidateJson = {};
    try {
      data = (await res.json()) as PolarValidateJson;
    } catch {
      data = {};
    }

    if (res.status === 200) {
      const granted =
        data.status === "granted" ||
        ((!data.error && !data.detail) && Boolean(data.id));
      if (!granted) {
        return {
          kind: "invalid",
          error: data.message || data.detail || data.error || "Invalid license key",
        };
      }
      if (benefitRequired && data.benefit_id !== benefitRequired) {
        return { kind: "invalid", error: "License key benefit does not match this product" };
      }
      return { kind: "ok" };
    }

    return {
      kind: "invalid",
      error: data.message || data.detail || data.error || "Invalid license key",
    };
  } catch {
    return { kind: "network", error: "Could not reach Polar" };
  }
}

async function verifyGumroadKey(
  key: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<LicenseResult> {
  const product = env.GUMROAD_PRODUCT_PERMALINK || env.GUMROAD_PRODUCT_ID || "";
  const body = new URLSearchParams({
    license_key: key,
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

/**
 * License gate:
 * - No Polar/Gumroad env: accept FEEDPATCH-DEV (incl. production) and HMAC-signed FP1 keys.
 * - Commerce env present: reject demo/signed keys; verify real keys against Polar then Gumroad.
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

  if (!commerceConfigured(env)) {
    if (trimmed === DEV_LICENSE_KEY) {
      return { ok: true, source: "dev" };
    }
    if (verifySignedKey(trimmed, env)) {
      return { ok: true, source: "signed" };
    }
    return { ok: false, error: MISSING_CONFIG_COPY };
  }

  if (trimmed === DEV_LICENSE_KEY) {
    return { ok: false, error: devKeyRejectedCopy(env) };
  }
  if (SIGNED_KEY.test(trimmed)) {
    return { ok: false, error: signedKeyRejectedCopy(env) };
  }

  if (polarConfigured(env)) {
    const polar = await verifyPolarKey(trimmed, env, fetchImpl);
    if (polar.kind === "ok") {
      return { ok: true, source: "polar" };
    }
    if (polar.kind === "not_found" && gumroadConfigured(env)) {
      return verifyGumroadKey(trimmed, env, fetchImpl);
    }
    if (polar.kind === "not_found") {
      return { ok: false, error: "Invalid license key" };
    }
    return { ok: false, error: polar.error };
  }

  return verifyGumroadKey(trimmed, env, fetchImpl);
}
