import { describe, expect, it } from "vitest";
import { autoMapColumns, detectSource } from "@/lib/columns";
import { parseDelimited } from "@/lib/parse";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("autoMapColumns", () => {
  it("maps Shopify export headers", () => {
    const headers = [
      "Handle",
      "Title",
      "Body (HTML)",
      "Vendor",
      "Published",
      "Variant SKU",
      "Variant Price",
      "Variant Barcode",
      "Image Src",
      "URL",
      "Video URL",
      "Google Shopping / MPN",
    ];
    const mapping = autoMapColumns(headers);
    expect(mapping.id).toBe("Variant SKU");
    expect(mapping.title).toBe("Title");
    expect(mapping.description).toBe("Body (HTML)");
    expect(mapping.brand).toBe("Vendor");
    expect(mapping.availability).toBe("Published");
    expect(mapping.price).toBe("Variant Price");
    expect(mapping.gtin).toBe("Variant Barcode");
    expect(mapping.image_link).toBe("Image Src");
    expect(mapping.link).toBe("URL");
    expect(mapping.video_link).toBe("Video URL");
    expect(mapping.mpn).toBe("Google Shopping / MPN");
    expect(detectSource(headers)).toBe("shopify");
  });

  it("maps Woo and GMC headers", () => {
    const woo = autoMapColumns(["SKU", "Name", "Regular price", "Stock status", "Images"]);
    expect(woo.id).toBe("SKU");
    expect(woo.title).toBe("Name");
    expect(woo.price).toBe("Regular price");
    expect(woo.availability).toBe("Stock status");
    expect(detectSource(["regular price", "stock status"])).toBe("woo");

    const gmc = autoMapColumns(["id", "title", "image_link", "availability", "gtin", "price"]);
    expect(gmc.image_link).toBe("image_link");
    expect(detectSource(["id", "title", "image_link"])).toBe("gmc");
  });
});

describe("sample CSV", () => {
  it("is a 40-row Shopify export with 8.90E+12 barcodes", () => {
    const text = readFileSync(
      resolve(__dirname, "../public/sample-shopify-messy.csv"),
      "utf8",
    );
    const feed = parseDelimited(text, "sample-shopify-messy.csv");
    expect(feed.rows.length).toBe(40);
    expect(detectSource(feed.headers)).toBe("shopify");
    const barcodes = feed.rows.map((r) => r["Variant Barcode"]);
    expect(barcodes.some((b) => /8\.90E\+12/i.test(b))).toBe(true);
    expect(feed.rows.some((r) => r.Vendor === "")).toBe(true);
    expect(feed.rows.some((r) => r.Published === "TRUE")).toBe(true);
    expect(feed.rows.some((r) => /vimeo|cdn\.shopify\.com\/videos/i.test(r["Video URL"]))).toBe(
      true,
    );
  });
});
