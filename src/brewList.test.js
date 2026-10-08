import { describe, it, expect } from "vitest";
import {
  brewListAfterDelete,
  isHistoryLoading,
  isHistoryEmpty,
} from "./brewList";

describe("brewListAfterDelete", () => {
  it("removes the row with the matching id", () => {
    const before = [
      { id: "a", drink: "Latte" },
      { id: "b", drink: "Espresso" },
      { id: "c", drink: "Cortado" },
    ];
    expect(brewListAfterDelete(before, "b")).toEqual([
      { id: "a", drink: "Latte" },
      { id: "c", drink: "Cortado" },
    ]);
  });

  it("returns the same list (by content) when the id isn't present", () => {
    const before = [{ id: "a" }, { id: "b" }];
    expect(brewListAfterDelete(before, "z")).toEqual(before);
  });

  it("handles an empty list", () => {
    expect(brewListAfterDelete([], "x")).toEqual([]);
  });

  it("does not mutate the input", () => {
    const before = [{ id: "a" }, { id: "b" }];
    brewListAfterDelete(before, "a");
    expect(before).toEqual([{ id: "a" }, { id: "b" }]);
  });
});

describe("isHistoryLoading", () => {
  it("is true only when pastBrews is undefined (initial fetch in flight)", () => {
    expect(isHistoryLoading(undefined)).toBe(true);
  });

  it("is false after the fetch resolves to an empty list", () => {
    expect(isHistoryLoading([])).toBe(false);
  });

  it("is false after the fetch resolves to rows", () => {
    expect(isHistoryLoading([{ id: "a" }])).toBe(false);
  });
});

describe("isHistoryEmpty", () => {
  it("is true only for an empty array, not undefined (still loading)", () => {
    expect(isHistoryEmpty(undefined)).toBe(false);
    expect(isHistoryEmpty([])).toBe(true);
  });

  it("is false when there are rows", () => {
    expect(isHistoryEmpty([{ id: "a" }])).toBe(false);
  });
});