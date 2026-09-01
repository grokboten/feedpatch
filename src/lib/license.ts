import { DEV_LICENSE_KEY } from "./types";

export type LicenseResult = {
  ok: boolean;
  source?: "dev" | "gumroad";
  error?: string;
};

export function gumroadConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.GUMROAD_ACCESS_TOKEN || env.GUMROAD_PRODUCT_PERMALINK || env.GUMROAD_PRODUCT_ID,
  );
}

/**
 * License gate:
 * - No Gumroad env + development → accept FEEDPATCH-DEV only.
 * - No Gumroad env + production → fail closed (even FEEDPATCH-DEV).
 * - Gumroad env present → verify against Gumroad; never invent a token.
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
    if (env.NODE_ENV !== "production" && trimmed === DEV_LICENSE_KEY) {
      return { ok: true, source: "dev" };
    }
    if (env.NODE_ENV === "production") {
      return { ok: false, error: "License verification is not configured" };
    }
    return { ok: false, error: "Invalid license key" };
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
