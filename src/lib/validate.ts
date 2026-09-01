import type { GmcField, GmcItem, Issue } from "./types";
import { AVAILABILITY_VALUES, ISO_CURRENCIES, REQUIRED_FIELDS } from "./types";
import { identifiersEmpty, isYouTubeUrl } from "./fix";
import { isValidGtin, repairGtin } from "./gtin";

const PROMO_WORDS = [
  "free shipping",
  "best price",
  "buy now",
  "click here",
  "limited time",
  "100%",
  "cheap",
  "sale!!!",
  "$$$",
  "best seller",
  "hot deal",
  "act now",
];

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function titleIsAllCaps(title: string): boolean {
  const letters = title.replace(/[^A-Za-z]/g, "");
  if (letters.length < 8) return false;
  return letters === letters.toUpperCase();
}

export function validateItem(item: GmcItem, duplicateIds: Set<string>): Issue[] {
  const issues: Issue[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!item[field].trim()) {
      issues.push({
        field,
        severity: "error",
        code: "required",
        message: `${field} is required`,
      });
    }
  }

  if (item.id.trim() && duplicateIds.has(item.id.trim())) {
    issues.push({
      field: "id",
      severity: "error",
      code: "duplicate_id",
      message: "Duplicate id — Merchant Center will reject or overwrite",
    });
  }

  if (item.link.trim() && !isAbsoluteHttpUrl(item.link)) {
    issues.push({
      field: "link",
      severity: "error",
      code: "url",
      message: "link must be an absolute http(s) URL",
    });
  }

  if (item.image_link.trim()) {
    if (!isAbsoluteHttpUrl(item.image_link)) {
      issues.push({
        field: "image_link",
        severity: "error",
        code: "url",
        message: "image_link must be an absolute http(s) URL",
      });
    } else {
      issues.push({
        field: "image_link",
        severity: "warning",
        code: "image_size_unproven",
        message:
          "Cannot prove 500×500 without fetching the image — not marked as pass",
      });
    }
  }

  if (item.additional_image_link.trim() && !isAbsoluteHttpUrl(item.additional_image_link)) {
    issues.push({
      field: "additional_image_link",
      severity: "error",
      code: "url",
      message: "additional_image_link must be an absolute http(s) URL",
    });
  }

  if (item.availability.trim()) {
    if (!AVAILABILITY_VALUES.includes(item.availability.trim() as (typeof AVAILABILITY_VALUES)[number])) {
      issues.push({
        field: "availability",
        severity: "error",
        code: "availability_enum",
        message: "availability must be in_stock, out_of_stock, preorder, or backorder",
      });
    }
  }

  if (item.price.trim()) {
    const m = /^(\d+(?:\.\d+)?)\s+([A-Z]{3})$/.exec(item.price.trim());
    if (!m || !ISO_CURRENCIES.has(m[2])) {
      issues.push({
        field: "price",
        severity: "error",
        code: "price_format",
        message: "price must be a number plus ISO currency, e.g. 19.99 USD",
      });
    }
  }

  if (item.gtin.trim()) {
    if (!isValidGtin(item.gtin.trim())) {
      const attempt = repairGtin(item.gtin);
      issues.push({
        field: "gtin",
        severity: "error",
        code: "gtin_invalid",
        message: attempt.error || "GTIN must be GTIN-8/12/13/14 with a valid GS1 check digit",
      });
    }
  }

  const ie = item.identifier_exists.trim().toLowerCase();
  const none = identifiersEmpty(item);
  if (none && (ie === "yes" || ie === "true" || ie === "1" || ie === "")) {
    issues.push({
      field: "identifier_exists",
      severity: "error",
      code: "identifier_exists_conflict",
      message: "No brand, gtin, or mpn — identifier_exists must be no",
    });
  }
  if (!none && (ie === "no" || ie === "false" || ie === "0")) {
    issues.push({
      field: "identifier_exists",
      severity: "error",
      code: "identifier_exists_conflict",
      message: "identifier_exists=no but brand, gtin, or mpn is present",
    });
  }

  if (item.title.trim()) {
    if (item.title.length > 150) {
      issues.push({
        field: "title",
        severity: "warning",
        code: "title_length",
        message: "Title exceeds 150 characters",
      });
    }
    if (titleIsAllCaps(item.title)) {
      issues.push({
        field: "title",
        severity: "warning",
        code: "title_caps",
        message: "Title is ALL CAPS",
      });
    }
    const lower = item.title.toLowerCase();
    const hit = PROMO_WORDS.find((w) => lower.includes(w));
    if (hit) {
      issues.push({
        field: "title",
        severity: "warning",
        code: "title_promo",
        message: `Title contains promotional wording (“${hit}”)`,
      });
    }
  }

  if (item.video_link.trim() && !isYouTubeUrl(item.video_link)) {
    issues.push({
      field: "video_link",
      severity: "error",
      code: "video_link",
      message: "video_link must be a YouTube URL or empty (2026 GMC shape)",
    });
  }

  return issues;
}

export function collectDuplicateIds(items: GmcItem[]): Set<string> {
  const seen = new Map<string, number>();
  const dup = new Set<string>();
  for (const item of items) {
    const id = item.id.trim();
    if (!id) continue;
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    if (n > 1) dup.add(id);
  }
  return dup;
}

export function statusForIssues(issues: Issue[] | null): "red" | "amber" | "green" | "unscored" {
  if (!issues) return "unscored";
  if (issues.some((i) => i.severity === "error")) return "red";
  if (issues.some((i) => i.severity === "warning")) return "amber";
  return "green";
}

export function fieldIssue(issues: Issue[], field: GmcField): Issue | undefined {
  return issues.find((i) => i.field === field);
}
