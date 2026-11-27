import { describe, it, expect } from "vitest";
import {
  thumbLookupPath,
  lookupThumbUrl,
  shouldSignOnLazy,
  pathsNeedingRefresh,
} from "./brewPhoto";

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
  const NOW = 1_000_000;
  const future = { url: "https://signed/x", expiresAt: NOW + 60_000 };

  it("returns the cached signed URL for the thumb path", () => {
    const cache = { "u/b.thumb.jpg": future };
    expect(
      lookupThumbUrl(cache, { thumb_path: "u/b.thumb.jpg", photo_path: "u/b.jpg" }, NOW)
    ).toBe("https://signed/x");
  });

  it("falls back to the photo_path URL when there's no thumb", () => {
    const cache = { "u/b.jpg": future };
    expect(lookupThumbUrl(cache, { thumb_path: null, photo_path: "u/b.jpg" }, NOW))
      .toBe("https://signed/x");
  });

  it("returns null when nothing has been signed yet", () => {
    expect(lookupThumbUrl({}, { thumb_path: "u/b.thumb.jpg", photo_path: "u/b.jpg" }, NOW))
      .toBe(null);
  });

  it("returns null when the brew has no photo at all", () => {
    expect(lookupThumbUrl({ x: future }, {}, NOW)).toBe(null);
  });

  it("hides an entry that has already expired", () => {
    // A dead URL renders as a broken image, which looks worse than the
    // placeholder — so expiry is treated as absent.
    const cache = { "u/b.thumb.jpg": { url: "https://signed/dead", expiresAt: NOW - 1 } };
    expect(lookupThumbUrl(cache, { thumb_path: "u/b.thumb.jpg" }, NOW)).toBe(null);
  });

  it("treats an entry with no deadline as usable", () => {
    const cache = { "u/b.thumb.jpg": { url: "https://signed/x" } };
    expect(lookupThumbUrl(cache, { thumb_path: "u/b.thumb.jpg" }, NOW)).toBe("https://signed/x");
  });
});

describe("pathsNeedingRefresh", () => {
  const NOW = 5_000_000;
  const SLACK = 120_000;

  it("asks for paths that were never signed", () => {
    expect(pathsNeedingRefresh({}, ["a", "b"], NOW, SLACK)).toEqual(["a", "b"]);
  });

  it("leaves a comfortably fresh URL alone", () => {
    const cache = { a: { url: "u", expiresAt: NOW + 10 * 60_000 } };
    expect(pathsNeedingRefresh(cache, ["a"], NOW, SLACK)).toEqual([]);
  });

  it("refreshes inside the slack window, before the URL actually dies", () => {
    const cache = { a: { url: "u", expiresAt: NOW + 60_000 } };
    expect(pathsNeedingRefresh(cache, ["a"], NOW, SLACK)).toEqual(["a"]);
  });

  it("refreshes an already-expired URL", () => {
    const cache = { a: { url: "u", expiresAt: NOW - 1 } };
    expect(pathsNeedingRefresh(cache, ["a"], NOW, SLACK)).toEqual(["a"]);
  });

  it("ignores empty paths and preserves input order", () => {
    const cache = { b: { url: "u", expiresAt: NOW - 1 } };
    expect(pathsNeedingRefresh(cache, [null, "b", "", "c"], NOW, SLACK)).toEqual(["b", "c"]);
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