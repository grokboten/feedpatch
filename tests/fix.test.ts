import { describe, expect, it } from "vitest";
import {
  applyFixes,
  applyIdentifierExistsRule,
  coerceAvailability,
  coercePrice,
  emptyItem,
  identifiersEmpty,
} from "@/lib/fix";
import { DEFAULT_FIXES } from "@/lib/types";

describe("coerceAvailability", () => {
  it("maps TRUE / in stock to in_stock", () => {
    expect(coerceAvailability("TRUE")).toBe("in_stock");
    expect(coerceAvailability("in stock")).toBe("in_stock");
    expect(coerceAvailability("FALSE")).toBe("out_of_stock");
  });
});

describe("coercePrice", () => {
  it("formats 19.99 as 19.99 USD", () => {
    expect(coercePrice("19.99")).toBe("19.99 USD");
    expect(coercePrice("19.99 USD")).toBe("19.99 USD");
    expect(coercePrice("$32")).toBe("32.00 USD");
  });
});

describe("identifier_exists", () => {
  it("sets no only when brand + gtin + mpn are empty", () => {
    const none = applyIdentifierExistsRule({
      ...emptyItem(),
      brand: "",
      gtin: "",
      mpn: "",
    });
    expect(none.identifier_exists).toBe("no");
    expect(identifiersEmpty(none)).toBe(true);

    const hasGtin = applyIdentifierExistsRule({
      ...emptyItem(),
      gtin: "8900000000005",
    });
    expect(hasGtin.identifier_exists).toBe("yes");
  });
});

describe("applyFixes", () => {
  it("applies GTIN, price, availability, video strip, identifier_exists", () => {
    const item = {
      ...emptyItem(),
      id: "FP-1",
      title: "Tee",
      description: "<p>Hello&nbsp;world</p>",
      gtin: "8.900000000005E+12",
      availability: "TRUE",
      price: "19.99",
      brand: "",
      mpn: "",
      video_link: "https://vimeo.com/123",
    };
    const patched = applyFixes(item, DEFAULT_FIXES);
    expect(patched.gtin).toBe("8900000000005");
    expect(patched.availability).toBe("in_stock");
    expect(patched.price).toBe("19.99 USD");
    expect(patched.video_link).toBe("");
    expect(patched.description).toBe("Hello world");
    expect(patched.identifier_exists).toBe("yes");
  });

  it("does not invent a GTIN when the check digit cannot be recovered", () => {
    const patched = applyFixes(
      { ...emptyItem(), gtin: "8.90E+12", brand: "Acme", mpn: "" },
      DEFAULT_FIXES,
    );
    expect(patched.gtin).toBe("8.90E+12");
  });
});
