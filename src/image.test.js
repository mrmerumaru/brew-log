import { describe, it, expect } from "vitest";
import { targetSize, THUMB_MAX_EDGE, MAX_EDGE } from "./image";

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