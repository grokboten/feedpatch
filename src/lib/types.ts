export const GMC_FIELDS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "additional_image_link",
  "availability",
  "price",
  "brand",
  "gtin",
  "mpn",
  "identifier_exists",
  "condition",
  "item_group_id",
  "product_type",
  "google_product_category",
  "video_link",
] as const;

export type GmcField = (typeof GMC_FIELDS)[number];

export type GmcItem = Record<GmcField, string>;

export type Severity = "error" | "warning";

export type Issue = {
  field: GmcField | "row";
  severity: Severity;
  code: string;
  message: string;
};

export type RowStatus = "red" | "amber" | "green" | "unscored";

export type ScoredRow = {
  index: number;
  original: GmcItem;
  patched: GmcItem;
  issues: Issue[];
  status: RowStatus;
  changed: GmcField[];
};

export type ColumnMapping = Partial<Record<GmcField, string>>;

export type ParsedFeed = {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  format: "csv" | "tsv" | "xlsx" | "xml";
};

export type FixToggles = {
  gtin: boolean;
  identifierExists: boolean;
  availability: boolean;
  price: boolean;
  videoLink: boolean;
  stripHtml: boolean;
};

export const DEFAULT_FIXES: FixToggles = {
  gtin: true,
  identifierExists: true,
  availability: true,
  price: true,
  videoLink: true,
  stripHtml: true,
};

export const REQUIRED_FIELDS: GmcField[] = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "price",
  "availability",
];

export const ISO_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "NOK",
  "SEK",
  "DKK",
  "CAD",
  "AUD",
  "JPY",
  "CHF",
  "NZD",
  "PLN",
  "CZK",
  "MXN",
  "BRL",
  "INR",
  "SGD",
  "HKD",
  "KRW",
  "CNY",
  "TRY",
  "ZAR",
  "AED",
]);

export const AVAILABILITY_VALUES = [
  "in_stock",
  "out_of_stock",
  "preorder",
  "backorder",
] as const;

export const FREE_SCORED_ROWS = 25;
export const FREE_EXPORT_ROWS = 5;
export const FREE_ACTION_ISSUES = 5;
export const PAID_ROW_CAP = 50_000;
export const DEV_LICENSE_KEY = "FEEDPATCH-DEV";
