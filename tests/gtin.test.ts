import { describe, expect, it } from "vitest";
import { expandScientificNotation, gs1CheckDigit, isValidGtin, repairGtin } from "@/lib/gtin";

describe("gs1CheckDigit", () => {
  it("matches known GTIN-13 / UPC-A / GTIN-8", () => {
    expect(gs1CheckDigit("890000000000")).toBe(5);
    expect(gs1CheckDigit("03600029145")).toBe(2);
    expect(gs1CheckDigit("1234567")).toBe(0);
    expect(isValidGtin("8900000000005")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("12345670")).toBe(true);
  });
});

describe("expandScientificNotation", () => {
  it("expands Excel 8.90E+12 barcodes without inventing digits", () => {
    expect(expandScientificNotation("8.90E+12")).toBe("8900000000000");
    expect(expandScientificNotation("8.900000000005E+12")).toBe("8900000000005");
    expect(expandScientificNotation("8.90e+12")).toBe("8900000000000");
    expect(expandScientificNotation("-8.90E+12")).toBeNull();
  });
});

describe("repairGtin", () => {
  it("repairs scientific notation to a valid GTIN as text", () => {
    const r = repairGtin("8.900000000005E+12");
    expect(r.valid).toBe(true);
    expect(r.value).toBe("8900000000005");
    expect(r.repaired).toBe(true);
  });

  it("pads leading zeros when the check digit already matches", () => {
    const r = repairGtin("123456784");
    expect(r.valid).toBe(true);
    expect(r.value).toBe("000123456784");
  });

  it("never invents a check digit — 8.90E+12 stays unchanged", () => {
    const r = repairGtin("8.90E+12");
    expect(r.valid).toBe(false);
    expect(r.value).toBe("8.90E+12");
    expect(r.repaired).toBe(false);
  });

  it("leaves an invalid check digit untouched", () => {
    const r = repairGtin("8900000000000");
    expect(r.valid).toBe(false);
    expect(r.value).toBe("8900000000000");
  });

  it("treats empty as valid-empty (no identifier)", () => {
    const r = repairGtin("  ");
    expect(r.valid).toBe(true);
    expect(r.value).toBe("");
  });
});
