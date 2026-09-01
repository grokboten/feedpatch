import type { ColumnMapping, GmcField, GmcItem } from "./types";
import { GMC_FIELDS } from "./types";
import { emptyItem } from "./fix";

function norm(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");
}

const EXACT: Record<string, GmcField> = {
  id: "id",
  sku: "id",
  "variant sku": "id",
  "item sku": "id",
  handle: "id",
  title: "title",
  name: "title",
  "product title": "title",
  "product name": "title",
  description: "description",
  "body (html)": "description",
  "body html": "description",
  "short description": "description",
  "product description": "description",
  link: "link",
  url: "link",
  "product url": "link",
  "product permalink": "link",
  permalink: "link",
  image_link: "image_link",
  "image link": "image_link",
  "image src": "image_link",
  images: "image_link",
  image: "image_link",
  "featured image": "image_link",
  additional_image_link: "additional_image_link",
  "additional image link": "additional_image_link",
  "variant image": "additional_image_link",
  availability: "availability",
  published: "availability",
  "stock status": "availability",
  "in stock?": "availability",
  "inventory status": "availability",
  price: "price",
  "variant price": "price",
  "regular price": "price",
  "sale price": "price",
  brand: "brand",
  vendor: "brand",
  "product brand": "brand",
  "tax:product_brand": "brand",
  gtin: "gtin",
  barcode: "gtin",
  "variant barcode": "gtin",
  ean: "gtin",
  upc: "gtin",
  isbn: "gtin",
  mpn: "mpn",
  "google shopping mpn": "mpn",
  "google shopping / mpn": "mpn",
  identifier_exists: "identifier_exists",
  "identifier exists": "identifier_exists",
  condition: "condition",
  "google shopping condition": "condition",
  "google shopping / condition": "condition",
  item_group_id: "item_group_id",
  "item group id": "item_group_id",
  "parent": "item_group_id",
  "parent sku": "item_group_id",
  product_type: "product_type",
  "product type": "product_type",
  type: "product_type",
  google_product_category: "google_product_category",
  "google product category": "google_product_category",
  "google shopping / google product category": "google_product_category",
  "product category": "google_product_category",
  video_link: "video_link",
  "video link": "video_link",
  "video url": "video_link",
  "video": "video_link",
};

const PRIORITY: GmcField[] = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "availability",
  "price",
  "brand",
  "gtin",
  "mpn",
  "identifier_exists",
  "condition",
  "video_link",
  "additional_image_link",
  "item_group_id",
  "product_type",
  "google_product_category",
];

const ID_PREFERENCE = [
  "variant sku",
  "sku",
  "id",
  "item sku",
  "handle",
];

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedHeaders = new Set<string>();
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    byNorm.set(norm(h), h);
  }

  const idHeader = ID_PREFERENCE.map((n) => byNorm.get(n)).find(Boolean);
  if (idHeader) {
    mapping.id = idHeader;
    usedHeaders.add(idHeader);
  }

  for (const header of headers) {
    if (usedHeaders.has(header)) continue;
    const n = norm(header);
    const field = EXACT[n];
    if (field && !mapping[field]) {
      mapping[field] = header;
      usedHeaders.add(header);
    }
  }

  for (const header of headers) {
    if (usedHeaders.has(header)) continue;
    const n = norm(header);
    for (const field of PRIORITY) {
      if (mapping[field]) continue;
      if (n === field.replace(/_/g, " ") || n.includes(field.replace(/_/g, " "))) {
        mapping[field] = header;
        usedHeaders.add(header);
        break;
      }
    }
  }

  return mapping;
}

export function applyMapping(
  row: Record<string, string>,
  mapping: ColumnMapping,
): GmcItem {
  const item = emptyItem();
  for (const field of GMC_FIELDS) {
    const header = mapping[field];
    if (!header) continue;
    const value = row[header];
    item[field] = value == null ? "" : String(value);
  }
  if (!item.id.trim() && mapping.id == null) {
    const handle = row["Handle"] ?? row["handle"];
    if (handle) item.id = String(handle);
  }
  return item;
}

export function detectSource(headers: string[]): "shopify" | "woo" | "gmc" | "unknown" {
  const n = headers.map(norm);
  const has = (x: string) => n.includes(x);
  if (has("handle") && has("variant sku") && has("variant barcode")) return "shopify";
  if (has("published") && (has("variant price") || has("image src"))) return "shopify";
  if (has("regular price") || has("tax:product_brand") || has("stock status")) return "woo";
  if ((has("image_link") || has("image link")) && has("availability") && has("gtin")) return "gmc";
  if (has("id") && has("title") && (has("image_link") || has("image link"))) return "gmc";
  return "unknown";
}
