import { NextResponse } from "next/server";
import { verifyLicenseKey } from "@/lib/license";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let key = "";
  try {
    const body = (await request.json()) as { key?: unknown };
    key = typeof body?.key === "string" ? body.key : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const result = await verifyLicenseKey(key, process.env);
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
