import { describe, it, expect } from "vitest";
import { thumbLookupPath } from "./brewPhoto";

describe("thumbLookupPath", () => {
  it("returns thumb_path when present", () => {
    expect(thumbLookupPath({ thumb_path: "u/b.thumb.jpg", photo_path: "u/b.jpg" }))
      .toBe("u/b.thumb.jpg");
  });

  it("falls back to photo_path when thumb_path is null (pre-thumbnail rows)", () => {
    expect(thumbLookupPath({ thumb_path: null, photo_path: "u/b.jpg" }))
      .toBe("u/b.jpg");
  });

  it("falls back to photo_path when thumb_path is missing entirely", () => {
    expect(thumbLookupPath({ photo_path: "u/b.jpg" }))
      .toBe("u/b.jpg");
  });

  it("returns null when neither is set", () => {
    expect(thumbLookupPath({})).toBe(null);
    expect(thumbLookupPath({ thumb_path: null, photo_path: null })).toBe(null);
  });
});