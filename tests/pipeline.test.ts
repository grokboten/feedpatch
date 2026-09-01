import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { autoMapColumns } from "@/lib/columns";
import { parseDelimited } from "@/lib/parse";
import { runPipeline } from "@/lib/pipeline";
import { DEFAULT_FIXES, FREE_SCORED_ROWS } from "@/lib/types";

function sample() {
  const text = readFileSync(
    resolve(__dirname, "../public/sample-shopify-messy.csv"),
    "utf8",
  );
  const feed = parseDelimited(text, "sample-shopify-messy.csv");
  const mapping = autoMapColumns(feed.headers);
  return { feed, mapping };
}

describe("runPipeline", () => {
  it("scores only the first 25 SKUs for free", () => {
    const { feed, mapping } = sample();
    const rows = runPipeline(feed, mapping, DEFAULT_FIXES, { paid: false });
    expect(rows.length).toBe(40);
    expect(rows.filter((r) => r.status !== "unscored")).toHaveLength(FREE_SCORED_ROWS);
    expect(rows.slice(FREE_SCORED_ROWS).every((r) => r.status === "unscored")).toBe(true);
  });

  it("scores every row when licensed", () => {
    const { feed, mapping } = sample();
    const rows = runPipeline(feed, mapping, DEFAULT_FIXES, { paid: true });
    expect(rows.every((r) => r.status !== "unscored")).toBe(true);
  });

  it("auto-fixes GTIN text, price, availability, identifier_exists", () => {
    const { feed, mapping } = sample();
    const rows = runPipeline(feed, mapping, DEFAULT_FIXES, { paid: true });
    const first = rows[0];
    expect(first.patched.gtin).toBe("8900000000005");
    expect(first.patched.price).toBe("19.99 USD");
    expect(first.patched.availability).toBe("in_stock");
    expect(first.patched.video_link).toBe("");
    expect(first.status === "red" || first.status === "amber" || first.status === "green").toBe(
      true,
    );

    const emptyIds = rows.find((r) => r.patched.id === "FP-1026");
    expect(emptyIds).toBeTruthy();
    expect(emptyIds!.patched.identifier_exists).toBe("no");
    expect(emptyIds!.patched.brand).toBe("");
    expect(emptyIds!.patched.gtin).toBe("");
    expect(emptyIds!.patched.mpn).toBe("");
  });
});
