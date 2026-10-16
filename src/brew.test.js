import { describe, it, expect } from "vitest";
import { pickCarryForward } from "./brew";

describe("pickCarryForward", () => {
  it("returns null when there are no brews", () => {
    expect(pickCarryForward([], "Pourover")).toBe(null);
    expect(pickCarryForward(null, "Pourover")).toBe(null);
    expect(pickCarryForward(undefined, "Pourover")).toBe(null);
  });

  it("returns the most recent brew when no method is requested", () => {
    // pastBrews comes from App.jsx ordered newest-first (created_at desc).
    const brews = [
      { id: "b", method: "Espresso", created_at: "2026-01-03" },
      { id: "a", method: "Pourover", created_at: "2026-01-02" },
    ];
    expect(pickCarryForward(brews, null)).toEqual(brews[0]);
    expect(pickCarryForward(brews, undefined)).toEqual(brews[0]);
    expect(pickCarryForward(brews, "")).toEqual(brews[0]);
  });

  it("picks the most recent brew whose method matches", () => {
    // Order: newest-first. Two Pourovers, one Espresso between them. The
    // second-newest (the Espresso) sits between the two Pourovers; the
    // carry-forward for "Pourover" must still find the newer Pourover
    // below it.
    const brews = [
      { id: "pourover", method: "Pourover", created_at: "2026-01-04" },
      { id: "espresso", method: "Espresso", created_at: "2026-01-03" },
      { id: "olderPourover", method: "Pourover", created_at: "2026-01-02" },
    ];
    expect(pickCarryForward(brews, "Pourover")).toEqual(brews[0]);
    expect(pickCarryForward(brews, "Espresso")).toEqual(brews[1]);
  });

  it("falls back to the most recent brew when no match exists for the method", () => {
    const brews = [
      { id: "a", method: "Espresso", created_at: "2026-01-02" },
      { id: "b", method: "Espresso", created_at: "2026-01-01" },
    ];
    expect(pickCarryForward(brews, "Pourover")).toEqual(brews[0]);
  });

  it("ignores brews with no method when matching a method", () => {
    const brews = [
      { id: "noMethod", created_at: "2026-01-05" },
      { id: "match", method: "Pourover", created_at: "2026-01-01" },
    ];
    expect(pickCarryForward(brews, "Pourover")).toEqual(brews[1]);
  });

  it("ignores brews with blank-string method", () => {
    const brews = [
      { id: "blank", method: "", created_at: "2026-01-05" },
      { id: "match", method: "Pourover", created_at: "2026-01-01" },
    ];
    expect(pickCarryForward(brews, "Pourover")).toEqual(brews[1]);
  });

  it("returns the most recent brew when no brews have a usable method", () => {
    // Pre-migration data: brews with no method. The helper should still
    // return brews[0] (the contract) so the form has something to fall
    // back to instead of an empty pre-fill.
    const brews = [{ id: "x" }, { id: "y" }];
    expect(pickCarryForward(brews, "Pourover")).toEqual(brews[0]);
  });

  it("does not mutate the input array", () => {
    const brews = [
      { id: "a", method: "Espresso", created_at: "2026-01-02" },
      { id: "b", method: "Pourover", created_at: "2026-01-01" },
    ];
    const before = JSON.stringify(brews);
    pickCarryForward(brews, "Pourover");
    expect(JSON.stringify(brews)).toBe(before);
  });
});