import type { FixToggles, GmcItem } from "./types";
import { ISO_CURRENCIES } from "./types";
import { repairGtin } from "./gtin";

const AVAIL_MAP: Record<string, string> = {
  true: "in_stock",
  yes: "in_stock",
  "1": "in_stock",
  instock: "in_stock",
  "in stock": "in_stock",
  in_stock: "in_stock",
  available: "in_stock",
  published: "in_stock",
  active: "in_stock",
  false: "out_of_stock",
  no: "out_of_stock",
  "0": "out_of_stock",
  outofstock: "out_of_stock",
  "out of stock": "out_of_stock",
  out_of_stock: "out_of_stock",
  unavailable: "out_of_stock",
  unpublished: "out_of_stock",
  "sold out": "out_of_stock",
  soldout: "out_of_stock",
  draft: "out_of_stock",
  preorder: "preorder",
  "pre-order": "preorder",
  pre_order: "preorder",
  backorder: "backorder",
  "back-order": "backorder",
  back_order: "backorder",
};

export function coerceAvailability(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const compact = key.replace(/\s+/g, "");
  if (AVAIL_MAP[key]) return AVAIL_MAP[key];
  if (AVAIL_MAP[compact]) return AVAIL_MAP[compact];
  if (AVAIL_MAP[raw.trim().toLowerCase()]) return AVAIL_MAP[raw.trim().toLowerCase()];
  return null;
}

function formatAmount(amount: string, currency: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  const zeroDecimal = new Set(["JPY", "KRW"]);
  const formatted = zeroDecimal.has(currency) ? String(Math.round(n)) : n.toFixed(2);
  return `${formatted} ${currency}`;
}

export function coercePrice(raw: string, defaultCurrency = "USD"): string | null {
  const s = raw.trim();
  if (!s) return null;

  const already = /^(\d+(?:[.,]\d+)?)[\s]+([A-Za-z]{3})$/.exec(s);
  if (already) {
    const currency = already[2].toUpperCase();
    if (ISO_CURRENCIES.has(currency)) {
      return formatAmount(already[1].replace(",", "."), currency);
    }
  }

  const trailing = /^(\d+(?:[.,]\d+)?)([A-Za-z]{3})$/.exec(s);
  if (trailing) {
    const currency = trailing[2].toUpperCase();
    if (ISO_CURRENCIES.has(currency)) {
      return formatAmount(trailing[1].replace(",", "."), currency);
    }
  }

  const leadingCur = /^([A-Za-z]{3})\s*(\d+(?:[.,]\d+)?)$/.exec(s);
  if (leadingCur && ISO_CURRENCIES.has(leadingCur[1].toUpperCase())) {
    return formatAmount(leadingCur[2].replace(",", "."), leadingCur[1].toUpperCase());
  }

  const symbols: Record<string, string> = {
    $: "USD",
    "€": "EUR",
    "£": "GBP",
    kr: "NOK",
  };
  const symbol = /^(€|\$|£)\s*(\d+(?:[.,]\d+)?)$/.exec(s);
  if (symbol) {
    return formatAmount(symbol[2].replace(",", "."), symbols[symbol[1]]);
  }

  const trailingSymbol = /^(\d+(?:[.,]\d+)?)\s*(€|\$|£|kr)$/i.exec(s);
  if (trailingSymbol) {
    const sym = trailingSymbol[2].toLowerCase() === "kr" ? "kr" : trailingSymbol[2];
    return formatAmount(trailingSymbol[1].replace(",", "."), symbols[sym] || "USD");
  }

  const plain = /^(\d+(?:[.,]\d+)?)$/.exec(s);
  if (plain) {
    return formatAmount(plain[1].replace(",", "."), defaultCurrency);
  }

  return null;
}

export function identifiersEmpty(item: Pick<GmcItem, "brand" | "gtin" | "mpn">): boolean {
  return !item.brand.trim() && !item.gtin.trim() && !item.mpn.trim();
}

export function applyIdentifierExistsRule(item: GmcItem): GmcItem {
  if (identifiersEmpty(item)) {
    return { ...item, identifier_exists: "no", gtin: "", mpn: "" };
  }
  const ie = item.identifier_exists.trim().toLowerCase();
  if (!ie || ie === "true" || ie === "yes" || ie === "1") {
    return { ...item, identifier_exists: "yes" };
  }
  return item;
}

export function isYouTubeUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return true;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return (
      host === "youtube.com" ||
      host === "youtu.be" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube.com")
    );
  } catch {
    return false;
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function emptyItem(): GmcItem {
  return {
    id: "",
    title: "",
    description: "",
    link: "",
    image_link: "",
    additional_image_link: "",
    availability: "",
    price: "",
    brand: "",
    gtin: "",
    mpn: "",
    identifier_exists: "",
    condition: "",
    item_group_id: "",
    product_type: "",
    google_product_category: "",
    video_link: "",
  };
}

export function applyFixes(item: GmcItem, toggles: FixToggles): GmcItem {
  let next: GmcItem = { ...item };

  if (toggles.stripHtml && next.description) {
    next.description = stripHtml(next.description);
  }

  if (toggles.gtin) {
    const repaired = repairGtin(next.gtin);
    if (repaired.valid) {
      next.gtin = repaired.value;
    }
  }

  if (toggles.availability) {
    const coerced = coerceAvailability(next.availability);
    if (coerced) next.availability = coerced;
  }

  if (toggles.price) {
    const coerced = coercePrice(next.price);
    if (coerced) next.price = coerced;
  }

  if (toggles.videoLink && next.video_link && !isYouTubeUrl(next.video_link)) {
    next.video_link = "";
  }

  if (toggles.identifierExists) {
    next = applyIdentifierExistsRule(next);
  }

  if (next.condition) {
    const c = next.condition.trim().toLowerCase();
    if (c === "new" || c === "used" || c === "refurbished") {
      next.condition = c;
    }
  }

  return next;
}

export function changedFields(original: GmcItem, patched: GmcItem): (keyof GmcItem)[] {
  const fields = Object.keys(original) as (keyof GmcItem)[];
  return fields.filter((f) => (original[f] ?? "").trim() !== (patched[f] ?? "").trim());
}
