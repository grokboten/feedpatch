import { describe, expect, it } from "vitest";
import { emptyItem } from "@/lib/fix";
import { statusForIssues, validateItem } from "@/lib/validate";

describe("validateItem", () => {
  it("marks required gaps as errors (red) and image-unproven as warning (amber)", () => {
    const missing = validateItem(emptyItem(), new Set());
    expect(missing.some((i) => i.code === "required")).toBe(true);
    expect(statusForIssues(missing)).toBe("red");

    const almost = validateItem(
      {
        ...emptyItem(),
        id: "1",
        title: "Mug",
        description: "A mug",
        link: "https://example.com/mug",
        image_link: "https://example.com/mug.jpg",
        price: "19.99 USD",
        availability: "in_stock",
        identifier_exists: "no",
      },
      new Set(),
    );
    expect(almost.some((i) => i.code === "image_size_unproven")).toBe(true);
    expect(statusForIssues(almost)).toBe("amber");
  });

  it("rejects a non-YouTube video_link", () => {
    const issues = validateItem(
      {
        ...emptyItem(),
        id: "1",
        title: "Mug",
        description: "A mug",
        link: "https://example.com/mug",
        image_link: "https://example.com/mug.jpg",
        price: "19.99 USD",
        availability: "in_stock",
        identifier_exists: "no",
        video_link: "https://vimeo.com/1",
      },
      new Set(),
    );
    expect(issues.some((i) => i.code === "video_link")).toBe(true);
  });
});
