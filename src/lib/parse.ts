import Papa from "papaparse";
import type { ParsedFeed } from "./types";
import { PAID_ROW_CAP } from "./types";

function asStringMap(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith("__")) continue;
    if (v == null) out[k] = "";
    else if (typeof v === "number" && Number.isFinite(v)) {
      if (Math.abs(v) >= 1e12 || String(v).includes("e")) {
        out[k] = v.toExponential();
      } else {
        out[k] = String(v);
      }
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

export function parseDelimited(text: string, fileName: string): ParsedFeed {
  const looksTsv =
    fileName.toLowerCase().endsWith(".tsv") ||
    (text.split("\n")[0] || "").includes("\t");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter: looksTsv ? "\t" : undefined,
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });
  const headers = (result.meta.fields || []).map((h) => h.replace(/^\uFEFF/, "").trim());
  const rows = result.data
    .map((r) => asStringMap(r as Record<string, unknown>))
    .filter((r) => Object.values(r).some((v) => v.trim() !== ""));
  return {
    fileName,
    headers,
    rows: rows.slice(0, PAID_ROW_CAP),
    format: looksTsv ? "tsv" : "csv",
  };
}

export async function parseXlsx(buffer: ArrayBuffer, fileName: string): Promise<ParsedFeed> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array", cellText: false, cellDates: false, raw: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { fileName, headers: [], rows: [], format: "xlsx" };
  }
  const sheet = wb.Sheets[sheetName];
  const rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of rowsRaw) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  const rows = rowsRaw
    .map(asStringMap)
    .filter((r) => Object.values(r).some((v) => v.trim() !== ""));
  return {
    fileName,
    headers,
    rows: rows.slice(0, PAID_ROW_CAP),
    format: "xlsx",
  };
}

function textOf(el: Element): string {
  return (el.textContent || "").trim();
}

function localName(el: Element): string {
  return (el.localName || el.tagName || "").replace(/^.*:/, "").toLowerCase();
}

export function parseGoogleXml(xmlText: string, fileName: string): ParsedFeed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Could not parse Google Shopping XML");
  }
  const items = Array.from(doc.querySelectorAll("item, entry"));
  const rows: Record<string, string>[] = [];
  const headerSet: string[] = [];
  const seen = new Set<string>();

  const take = (el: Element, row: Record<string, string>) => {
    for (const child of Array.from(el.children)) {
      const name = localName(child);
      if (child.children.length && !textOf(child)) {
        take(child, row);
        continue;
      }
      const value = textOf(child);
      if (!value) continue;
      const key = name;
      row[key] = row[key] ? `${row[key]}`.length ? row[key] : value : value;
      if (!row[key]) row[key] = value;
      if (value && !row[key]) row[key] = value;
      row[key] = value;
      if (!seen.has(key)) {
        seen.add(key);
        headerSet.push(key);
      }
    }
  };

  for (const item of items) {
    const row: Record<string, string> = {};
    take(item, row);
    if (Object.keys(row).length) rows.push(row);
  }

  return {
    fileName,
    headers: headerSet,
    rows: rows.slice(0, PAID_ROW_CAP),
    format: "xml",
  };
}

export async function parseFile(file: File): Promise<ParsedFeed> {
  const name = file.name || "upload";
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    return parseXlsx(buf, name);
  }
  const text = await file.text();
  if (
    lower.endsWith(".xml") ||
    text.trimStart().startsWith("<?xml") ||
    text.includes("<rss") ||
    text.includes("base.google.com")
  ) {
    return parseGoogleXml(text, name);
  }
  return parseDelimited(text, name);
}

export async function parseSampleCsv(url = "/sample-shopify-messy.csv"): Promise<ParsedFeed> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load sample CSV");
  const text = await res.text();
  return parseDelimited(text, "sample-shopify-messy.csv");
}
