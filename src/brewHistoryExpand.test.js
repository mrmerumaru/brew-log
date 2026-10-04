import { describe, it, expect } from "vitest";
import {
  shouldExpand,
  nextExpandedId,
  toggleExpandAll,
  tapCard,
} from "./brewHistoryExpand";

describe("shouldExpand", () => {
  it("returns true when expandAll is on, regardless of expandedId", () => {
    expect(shouldExpand({ expandAll: true, expandedId: null }, "a")).toBe(true);
    expect(shouldExpand({ expandAll: true, expandedId: "a" }, "b")).toBe(true);
  });

  it("returns true when the card's id matches expandedId", () => {
    expect(shouldExpand({ expandAll: false, expandedId: "a" }, "a")).toBe(true);
  });

  it("returns false otherwise", () => {
    expect(shouldExpand({ expandAll: false, expandedId: "a" }, "b")).toBe(false);
    expect(shouldExpand({ expandAll: false, expandedId: null }, "a")).toBe(false);
  });
});

describe("nextExpandedId", () => {
  it("returns the tapped id when no card is currently expanded", () => {
    expect(nextExpandedId(null, "a")).toBe("a");
  });

  it("returns null when tapping the already-expanded card (collapse)", () => {
    expect(nextExpandedId("a", "a")).toBeNull();
  });

  it("returns the tapped id when a different card was expanded (accordion)", () => {
    expect(nextExpandedId("a", "b")).toBe("b");
  });
});

describe("toggleExpandAll", () => {
  it("flips expandAll from false to true", () => {
    expect(toggleExpandAll({ expandAll: false, expandedId: null })).toEqual({
      expandAll: true,
      expandedId: null,
    });
  });

  it("flips expandAll from true to false, clearing any explicit expandedId", () => {
    expect(toggleExpandAll({ expandAll: true, expandedId: "a" })).toEqual({
      expandAll: false,
      expandedId: null,
    });
  });

  it("preserves expandedId when turning expandAll on (no-op for that field)", () => {
    expect(toggleExpandAll({ expandAll: false, expandedId: "a" })).toEqual({
      expandAll: true,
      expandedId: "a",
    });
  });
});

describe("tapCard", () => {
  it("when expandAll is on, exits expand-all mode and shows only the tapped card", () => {
    expect(tapCard({ expandAll: true, expandedId: null }, "b")).toEqual({
      expandAll: false,
      expandedId: "b",
    });
  });

  it("when expandAll is on and the tapped card is already explicit, collapses it and exits expand-all", () => {
    expect(tapCard({ expandAll: true, expandedId: "b" }, "b")).toEqual({
      expandAll: false,
      expandedId: null,
    });
  });

  it("when expandAll is off and a different card is expanded, switches to the tapped one", () => {
    expect(tapCard({ expandAll: false, expandedId: "a" }, "b")).toEqual({
      expandAll: false,
      expandedId: "b",
    });
  });

  it("when expandAll is off and the same card is expanded, collapses it", () => {
    expect(tapCard({ expandAll: false, expandedId: "a" }, "a")).toEqual({
      expandAll: false,
      expandedId: null,
    });
  });

  it("when expandAll is off and nothing is expanded, opens the tapped card", () => {
    expect(tapCard({ expandAll: false, expandedId: null }, "a")).toEqual({
      expandAll: false,
      expandedId: "a",
    });
  });
});
