import { describe, it, expect } from "vitest";
import {
  targetSize,
  THUMB_MAX_EDGE,
  MAX_EDGE,
  inputExtension,
  isLikelyImage,
  sniffImageType,
  classifyPhoto,
  STORED_EXT,
  STORED_CONTENT_TYPE,
} from "./image";

describe("targetSize — full size (MAX_EDGE)", () => {
  it("scales a portrait image to fit MAX_EDGE on the longest side", () => {
    const r = targetSize(1512, 2016, MAX_EDGE);
    expect(r.width).toBe(1500);
    expect(r.height).toBe(2000);
    expect(r.scale).toBeCloseTo(0.9921, 3);
  });

  it("never enlarges — leaves a small image alone", () => {
    const r = targetSize(800, 600, MAX_EDGE);
    expect(r.width).toBe(800);
    expect(r.height).toBe(600);
    expect(r.scale).toBe(1);
  });
});

describe("targetSize — thumbnail (THUMB_MAX_EDGE)", () => {
  it("scales a large landscape photo down to THUMB_MAX_EDGE", () => {
    const r = targetSize(4032, 3024, THUMB_MAX_EDGE);
    expect(r.width).toBe(256);
    expect(r.height).toBe(192);
    expect(r.scale).toBeCloseTo(0.0635, 3);
  });

  it("never enlarges a small source — common on screenshots", () => {
    const r = targetSize(100, 150, THUMB_MAX_EDGE);
    expect(r.width).toBe(100);
    expect(r.height).toBe(150);
    expect(r.scale).toBe(1);
  });

  it("handles square source at thumb size", () => {
    const r = targetSize(1080, 1080, THUMB_MAX_EDGE);
    expect(r.width).toBe(256);
    expect(r.height).toBe(256);
  });
});

// --- upload acceptance -----------------------------------------------------
//
// These pin the rule from the security audit (F04/F05): nothing is uploaded
// unless its bytes are an image we recognise, and everything stored is a JPEG
// this app encoded. A renamed file must never reach the bucket with the
// extension or MIME type it claimed.

const chars = (s) => [...s].map((c) => c.charCodeAt(0));
/** Fixed-length head, zero-padded, so sniffing sees a realistic buffer. */
const head = (arr, n = 32) => {
  const out = new Uint8Array(Math.max(n, arr.length));
  out.set(arr);
  return out;
};

const JPEG = head([0xff, 0xd8, 0xff, 0xe0]);
const PNG = head([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = head([...chars("RIFF"), 0, 0, 0, 0, ...chars("WEBP")]);
const GIF = head(chars("GIF89a"));
const HEIC = head([0, 0, 0, 0x18, ...chars("ftypheic")]);
const HTML = head(chars("<!DOCTYPE html><html><body>hi"));
const SVG = head(chars('<svg xmlns="http://www.w3.org/2000/svg">'));
const PDF = head(chars("%PDF-1.7\n"));

describe("inputExtension", () => {
  it("lowercases the extension", () => {
    expect(inputExtension("IMG_0042.HEIC")).toBe("heic");
    expect(inputExtension("photo.JPG")).toBe("jpg");
  });

  it("returns the last segment of a multi-dot name", () => {
    expect(inputExtension("brew.2026.final.png")).toBe("png");
  });

  it("returns an empty string when there is no extension", () => {
    expect(inputExtension("photo")).toBe("");
    expect(inputExtension("")).toBe("");
    expect(inputExtension(undefined)).toBe("");
  });
});

describe("isLikelyImage", () => {
  it("accepts a known extension even when the type is missing", () => {
    expect(isLikelyImage({ name: "brew.jpg", type: "" })).toBe(true);
    expect(isLikelyImage({ name: "brew.webp", type: "" })).toBe(true);
  });

  it("accepts any image/* MIME type", () => {
    expect(isLikelyImage({ name: "blob", type: "image/png" })).toBe(true);
  });

  it("refuses non-image declarations", () => {
    expect(isLikelyImage({ name: "notes.txt", type: "text/plain" })).toBe(false);
    expect(isLikelyImage({ name: "page.html", type: "text/html" })).toBe(false);
    expect(isLikelyImage(null)).toBe(false);
  });
});

describe("sniffImageType", () => {
  it("recognises the formats the app accepts", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(GIF)).toBe("image/gif");
    expect(sniffImageType(HEIC)).toBe("image/heic");
  });

  it("does not recognise documents or markup", () => {
    expect(sniffImageType(HTML)).toBe(null);
    expect(sniffImageType(SVG)).toBe(null);
    expect(sniffImageType(PDF)).toBe(null);
  });

  it("returns null for missing or too-short input", () => {
    expect(sniffImageType(null)).toBe(null);
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBe(null);
  });
});

describe("classifyPhoto", () => {
  it("accepts a file whose bytes really are an image", () => {
    expect(classifyPhoto({ name: "brew.jpg", type: "image/jpeg", head: JPEG })).toEqual({
      ok: true,
      type: "image/jpeg",
      reason: null,
    });
  });

  it("refuses a renamed non-image even though the name says .jpg", () => {
    // The attack the audit described: claim an image name, ship other bytes.
    expect(
      classifyPhoto({ name: "brew.jpg", type: "image/jpeg", head: HTML }),
    ).toEqual({ ok: false, type: null, reason: "not_an_image" });
  });

  it("refuses SVG, which is an image type but also carries script", () => {
    expect(
      classifyPhoto({ name: "brew.svg", type: "image/svg+xml", head: SVG }).ok,
    ).toBe(false);
  });

  it("accepts HEIC bytes — decoding is the browser's call, not this check's", () => {
    expect(classifyPhoto({ name: "IMG_1.HEIC", type: "", head: HEIC })).toEqual({
      ok: true,
      type: "image/heic",
      reason: null,
    });
  });

  it("trusts the declaration only when no bytes could be read", () => {
    expect(classifyPhoto({ name: "brew.jpg", type: "image/jpeg", head: null }).ok).toBe(true);
    expect(classifyPhoto({ name: "notes.txt", type: "text/plain", head: null }).ok).toBe(false);
  });
});

describe("stored photo shape", () => {
  it("is always a JPEG produced by this app", () => {
    expect(STORED_EXT).toBe("jpg");
    expect(STORED_CONTENT_TYPE).toBe("image/jpeg");
  });
});
