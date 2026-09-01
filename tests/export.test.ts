import { describe, expect, it, vi } from "vitest";
import {
  collectActionIssues,
  DOWNLOAD_NAMES,
  downloadBlob,
  freeWatermarkedTsv,
  itemsToPrimaryTsv,
  itemsToSupplementalTsv,
  MERCHANT_CENTER_NOTE,
  metaCatalogCsv,
  primaryTsvPayload,
  tsvBlob,
} from "@/lib/export";
import { emptyItem } from "@/lib/fix";
import type { ScoredRow } from "@/lib/types";
import { FREE_ACTION_ISSUES, FREE_EXPORT_ROWS, GMC_FIELDS } from "@/lib/types";

function row(partial: Partial<ScoredRow["patched"]>, changed: ScoredRow["changed"] = []): ScoredRow {
  const patched = { ...emptyItem(), id: "A", title: "Tee", ...partial };
  return {
    index: 0,
    original: emptyItem(),
    patched,
    issues: [
      {
        field: "title",
        severity: "warning",
        code: "title_caps",
        message: "Title is ALL CAPS",
      },
    ],
    status: "amber",
    changed: changed.length ? changed : (["gtin"] as ScoredRow["changed"]),
  };
}

describe("exports", () => {
  it("watermarks a 5-row free TSV", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      ...emptyItem(),
      id: `S${i}`,
      title: `Item ${i}`,
    }));
    const tsv = itemsToPrimaryTsv(items.slice(0, FREE_EXPORT_ROWS), true);
    expect(tsv.split("\n").filter(Boolean).length).toBe(1 + FREE_EXPORT_ROWS);
    expect(tsv).toContain("[FeedPatch free]");
    expect(tsv).toContain("Watermarked 5-row export");
  });

  it("free export still builds a TSV string/blob with watermarked rows", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      ...emptyItem(),
      id: `S${i}`,
      title: `Item ${i}`,
      description: "A product",
    }));
    const { text, blob } = freeWatermarkedTsv(items);
    expect(text).toContain("[FeedPatch free]");
    expect(text).toContain("Watermarked 5-row export");
    expect(text).toContain("S0");
    expect(text).not.toContain("S5");
    const lines = text.replace(/^\uFEFF/, "").split("\n").filter(Boolean);
    expect(lines).toHaveLength(1 + FREE_EXPORT_ROWS);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toMatch(/octet-stream/);
    const viaHelper = tsvBlob(text);
    expect(viaHelper.size).toBe(blob.size);
  });

  it("tsvBlob/download payload is a non-empty TSV with GMC headers", async () => {
    const items = [
      {
        ...emptyItem(),
        id: "SKU-1",
        title: "Mug",
        description: "A stoneware mug",
        link: "https://example.com/mug",
        image_link: "https://example.com/mug.jpg",
        price: "19.99 USD",
        availability: "in_stock",
      },
    ];
    const payload = primaryTsvPayload(items);
    expect(payload.filename).toBe(DOWNLOAD_NAMES.primary);
    expect(payload.blob).toBeInstanceOf(Blob);
    expect(payload.blob.size).toBeGreaterThan(0);
    expect(payload.blob.type).toMatch(/octet-stream|text\/plain/);
    expect(payload.text.startsWith("\uFEFF")).toBe(true);
    const bytes = new Uint8Array(await payload.blob.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const body = await payload.blob.text();
    expect(body.length).toBeGreaterThan(0);
    const header = body.replace(/^\uFEFF/, "").split("\n")[0];
    expect(header.split("\t")).toEqual([...GMC_FIELDS]);
    expect(body).toContain("SKU-1");
    expect(body).toContain("Mug");

    const free = primaryTsvPayload(
      Array.from({ length: 8 }, (_, i) => ({ ...emptyItem(), id: `S${i}`, title: `Item ${i}` })),
      true,
    );
    expect(free.filename).toBe(DOWNLOAD_NAMES.primaryFree);
    const freeBody = await free.blob.text();
    const freeLines = freeBody.replace(/^\uFEFF/, "").split("\n").filter(Boolean);
    expect(freeLines[0].split("\t")).toEqual([...GMC_FIELDS]);
    expect(freeLines).toHaveLength(1 + FREE_EXPORT_ROWS);
  });

  it("downloadBlob uses HTMLElement.click, not an untrusted MouseEvent", () => {
    const click = vi.fn();
    const dispatchEvent = vi.fn();
    const remove = vi.fn();
    const setAttribute = vi.fn();
    const a = {
      href: "",
      download: "",
      rel: "",
      style: { display: "" },
      setAttribute,
      click,
      dispatchEvent,
      remove,
    };
    const appendChild = vi.fn();
    const createElement = vi.fn(() => a);
    const createObjectURL = vi.fn(() => "blob:feedpatch-test");
    const revokeObjectURL = vi.fn();
    const setTimeoutFn = vi.fn();

    vi.stubGlobal("document", { createElement, body: { appendChild } });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("window", { setTimeout: setTimeoutFn });

    try {
      downloadBlob("feedpatch-primary.tsv", tsvBlob("id\ttitle\nSKU-1\tMug\n"));
      expect(createElement).toHaveBeenCalledWith("a");
      expect(a.download).toBe("feedpatch-primary.tsv");
      expect(appendChild).toHaveBeenCalled();
      expect(click).toHaveBeenCalledTimes(1);
      expect(dispatchEvent).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("supplemental TSV is id plus changed columns only", () => {
    const tsv = itemsToSupplementalTsv([
      row({ id: "A", gtin: "8900000000005", price: "19.99 USD" }, ["gtin", "price"]),
    ]);
    const header = tsv.replace(/^\uFEFF/, "").split("\n")[0];
    expect(header).toBe("id\tprice\tgtin");
    expect(header.split("\t")[0]).toBe("id");
    expect(header).not.toContain("title");
  });

  it("truncates the free action list to 5 issues", () => {
    const rows = Array.from({ length: 10 }, () => row({ id: "X" }));
    expect(collectActionIssues(rows, FREE_ACTION_ISSUES)).toHaveLength(5);
  });

  it("builds a Meta catalog CSV", () => {
    const csv = metaCatalogCsv([
      {
        ...emptyItem(),
        id: "1",
        title: "Mug",
        availability: "in_stock",
        price: "19.99 USD",
      },
    ]);
    expect(csv.startsWith("id,title,description,availability")).toBe(true);
    expect(csv).toContain("in stock");
  });

  it("ships a 6-line Merchant Center note", () => {
    expect(MERCHANT_CENTER_NOTE).toHaveLength(6);
  });
});
