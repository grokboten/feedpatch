import type { GmcField, GmcItem, Issue, ScoredRow } from "./types";
import { GMC_FIELDS } from "./types";

export function tsvEscape(value: string): string {
  const s = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[\t\n"]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function itemsToPrimaryTsv(items: GmcItem[], watermark = false): string {
  const headers = GMC_FIELDS.join("\t");
  const lines = items.map((item, i) => {
    const row: GmcItem = { ...item };
    if (watermark) {
      row.title = row.title
        ? `[FeedPatch free] ${row.title}`
        : "[FeedPatch free] untitled";
      if (i === 0) {
        row.description = `${row.description} [Watermarked 5-row export — unlock with a license for the full feed.]`.trim();
      }
    }
    return GMC_FIELDS.map((f) => tsvEscape(row[f] ?? "")).join("\t");
  });
  return `\uFEFF${headers}\n${lines.join("\n")}\n`;
}

export function supplementalColumns(rows: ScoredRow[]): GmcField[] {
  const changed = new Set<GmcField>();
  for (const row of rows) {
    for (const f of row.changed) {
      if (f !== "id") changed.add(f);
    }
  }
  return GMC_FIELDS.filter((f) => f !== "id" && changed.has(f));
}

export function itemsToSupplementalTsv(rows: ScoredRow[]): string {
  const cols = supplementalColumns(rows);
  const headers = ["id", ...cols].join("\t");
  const patchedRows = rows.filter((r) => r.changed.length > 0 && r.patched.id.trim());
  const lines = patchedRows.map((r) => {
    const cells = [tsvEscape(r.patched.id), ...cols.map((c) => tsvEscape(r.patched[c] ?? ""))];
    return cells.join("\t");
  });
  return `\uFEFF${headers}\n${lines.join("\n")}\n`;
}

export type ActionIssue = {
  sku: string;
  field: string;
  severity: string;
  code: string;
  issue: string;
  current: string;
  suggested: string;
};

export function collectActionIssues(rows: ScoredRow[], limit?: number): ActionIssue[] {
  const out: ActionIssue[] = [];
  for (const row of rows) {
    for (const issue of row.issues) {
      const field = issue.field === "row" ? "id" : issue.field;
      out.push({
        sku: row.patched.id,
        field,
        severity: issue.severity,
        code: issue.code,
        issue: issue.message,
        current: field in row.original ? row.original[field as GmcField] : "",
        suggested: field in row.patched ? row.patched[field as GmcField] : "",
      });
      if (limit && out.length >= limit) return out;
    }
  }
  return out;
}

export async function actionPlanXlsx(issues: ActionIssue[]): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(
    issues.map((i) => ({
      sku: i.sku,
      field: i.field,
      severity: i.severity,
      code: i.code,
      issue: i.issue,
      current: i.current,
      suggested: i.suggested,
    })),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "action");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}

export function metaCatalogCsv(items: GmcItem[]): string {
  const headers = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
    "gtin",
    "mpn",
    "video",
  ];
  const lines = items.map((item) => {
    const condition = item.condition.trim() || "new";
    const availability =
      item.availability === "in_stock"
        ? "in stock"
        : item.availability === "out_of_stock"
          ? "out of stock"
          : item.availability === "preorder"
            ? "preorder"
            : item.availability === "backorder"
              ? "available for order"
              : item.availability;
    const values = [
      item.id,
      item.title,
      item.description,
      availability,
      condition,
      item.price,
      item.link,
      item.image_link,
      item.brand,
      item.gtin,
      item.mpn,
      item.video_link,
    ];
    return values
      .map((v) => {
        const s = v ?? "";
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      })
      .join(",");
  });
  return `${headers.join(",")}\n${lines.join("\n")}\n`;
}

export const MERCHANT_CENTER_NOTE = [
  "1. In Merchant Center, open Products → Feeds (or Data sources).",
  "2. Upload feedpatch-primary.tsv as the primary feed: UTF-8, tab-delimited, Google template.",
  "3. Create a supplemental feed that matches on id and upload feedpatch-supplemental.tsv.",
  "4. Supplemental only contains id plus columns FeedPatch actually changed — leave the rest to the primary.",
  "5. Do not rename headers. They are GMC attribute names, including video_link.",
  "6. Wait 15–30 minutes, then re-open Needs attention. Image 500×500 still needs a real crawl; we did not fake a pass.",
];

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function tsvBlob(text: string): Blob {
  return new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
}

export function csvBlob(text: string): Blob {
  return new Blob([text], { type: "text/csv;charset=utf-8" });
}

export function scoreSummary(rows: ScoredRow[]): { errors: number; warnings: number; green: number } {
  let errors = 0;
  let warnings = 0;
  let green = 0;
  for (const r of rows) {
    if (r.status === "green") green += 1;
    errors += r.issues.filter((i: Issue) => i.severity === "error").length;
    warnings += r.issues.filter((i: Issue) => i.severity === "warning").length;
  }
  return { errors, warnings, green };
}
