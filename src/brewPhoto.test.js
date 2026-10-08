import { describe, it, expect } from "vitest";
import { thumbLookupPath, lookupThumbUrl, shouldSignOnLazy } from "./brewPhoto";

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

describe("lookupThumbUrl", () => {
  it("returns the cached signed URL for the thumb path", () => {
    const cache = { "u/b.thumb.jpg": "https://signed/u/b.thumb.jpg" };
    expect(
      lookupThumbUrl(cache, { thumb_path: "u/b.thumb.jpg", photo_path: "u/b.jpg" })
    ).toBe("https://signed/u/b.thumb.jpg");
  });

  it("falls back to the photo_path URL when there's no thumb", () => {
    const cache = { "u/b.jpg": "https://signed/u/b.jpg" };
    expect(lookupThumbUrl(cache, { thumb_path: null, photo_path: "u/b.jpg" }))
      .toBe("https://signed/u/b.jpg");
  });

  it("returns null when nothing has been signed yet", () => {
    expect(lookupThumbUrl({}, { thumb_path: "u/b.thumb.jpg", photo_path: "u/b.jpg" }))
      .toBe(null);
  });

  it("returns null when the brew has no photo at all", () => {
    expect(lookupThumbUrl({ "x": "y" }, {})).toBe(null);
  });
});

describe("shouldSignOnLazy", () => {
  it("returns true for the first window even before any IO fires", () => {
    // No visible signal — only sign the initial batch.
    expect(shouldSignOnLazy(0, -1, -1, 4)).toBe(true);
    expect(shouldSignOnLazy(4, -1, -1, 4)).toBe(true);
    expect(shouldSignOnLazy(5, -1, -1, 4)).toBe(false);
  });

  it("signs anything inside the visible window", () => {
    // Cards 2, 3, 4 visible.
    expect(shouldSignOnLazy(3, 4, 2, 4)).toBe(true);
    expect(shouldSignOnLazy(2, 4, 2, 4)).toBe(true);
    expect(shouldSignOnLazy(4, 4, 2, 4)).toBe(true);
  });

  it("signs a small lookahead past the bottom of the visible window", () => {
    // visible up to 4, padding 4 — index 8 should still be true, 9 false.
    expect(shouldSignOnLazy(8, 4, 2, 4)).toBe(true);
    expect(shouldSignOnLazy(9, 4, 2, 4)).toBe(false);
  });

  it("does not sign far below the visible window", () => {
    expect(shouldSignOnLazy(20, 4, 2, 4)).toBe(false);
  });

  it("does not sign far above the visible window", () => {
    // The window goes from lowestVisible-4 to highestVisible+4. If lowest
    // is 10, anything below 6 is out of window.
    expect(shouldSignOnLazy(0, 12, 10, 4)).toBe(false);
    expect(shouldSignOnLazy(5, 12, 10, 4)).toBe(false);
    expect(shouldSignOnLazy(6, 12, 10, 4)).toBe(true);
  });
});