import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MAX_CUSTOM_FLAVORS,
  STORAGE_KEY,
  normalize,
  isCustom,
  addCustom,
  removeCustom,
  loadCustom,
  saveCustom,
} from "./customFlavorTags";
import { FLAVORS } from "./tokens";

// Helper to drive load/save against an in-memory map so tests don't touch the
// real localStorage. Each test gets a fresh map in beforeEach.
function freshStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: vi.fn((k) => (k in data ? data[k] : null)),
    setItem: vi.fn((k, v) => {
      data[k] = String(v);
    }),
    removeItem: vi.fn((k) => {
      delete data[k];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(data)) delete data[k];
    }),
    _data: data,
  };
}

describe("normalize", () => {
  it("trims whitespace and collapses internal runs of whitespace", () => {
    expect(normalize("  Berry  Jam ")).toBe("Berry Jam");
    expect(normalize("berry\tjam")).toBe("berry jam");
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(normalize("")).toBeNull();
    expect(normalize("   ")).toBeNull();
  });

  it("returns null for inputs longer than 30 characters", () => {
    expect(normalize("a".repeat(31))).toBeNull();
  });

  it("keeps a 30-character tag intact", () => {
    expect(normalize("a".repeat(30))).toBe("a".repeat(30));
  });
});

describe("isCustom", () => {
  it("is true for a tag that is not in the built-in FLAVORS list", () => {
    expect(isCustom("Berry Jam")).toBe(true);
  });

  it("is false case-insensitively against the built-in list", () => {
    expect(isCustom("fruity")).toBe(false);
    expect(isCustom("FRUITY")).toBe(false);
  });

  it("is true for the empty string and null", () => {
    expect(isCustom("")).toBe(true);
    expect(isCustom(null)).toBe(true);
  });
});

describe("addCustom", () => {
  it("appends a new tag and reports it was added", () => {
    const result = addCustom([], "Berry Jam");
    expect(result.added).toBe(true);
    expect(result.list).toEqual(["Berry Jam"]);
  });

  it("rejects tags that match a built-in (case-insensitive)", () => {
    const result = addCustom([], "fruity");
    expect(result.added).toBe(false);
    expect(result.reason).toBe("builtin");
    expect(result.list).toEqual([]);
  });

  it("rejects duplicates already in the custom list (case-insensitive)", () => {
    const result = addCustom(["Berry Jam"], "berry jam");
    expect(result.added).toBe(false);
    expect(result.reason).toBe("duplicate");
    expect(result.list).toEqual(["Berry Jam"]);
  });

  it("rejects tags that fail normalization (empty, too long)", () => {
    expect(addCustom([], "").added).toBe(false);
    expect(addCustom([], "   ").added).toBe(false);
    expect(addCustom([], "a".repeat(31)).added).toBe(false);
  });

  it("rejects when at the cap and reports 'cap' with the existing list unchanged", () => {
    const full = Array.from({ length: MAX_CUSTOM_FLAVORS }, (_, i) => `tag${i}`);
    const result = addCustom(full, "one more");
    expect(result.added).toBe(false);
    expect(result.reason).toBe("cap");
    expect(result.list).toEqual(full);
  });

  it("normalizes input before storing", () => {
    const result = addCustom([], "  Berry  Jam  ");
    expect(result.list).toEqual(["Berry Jam"]);
  });
});

describe("removeCustom", () => {
  it("removes a tag case-insensitively and returns the new list", () => {
    expect(removeCustom(["Berry Jam", "Toffee"], "berry jam")).toEqual(["Toffee"]);
    expect(removeCustom(["Berry Jam"], "BERRY JAM")).toEqual([]);
  });

  it("returns the list unchanged when the tag is not present", () => {
    expect(removeCustom(["Berry Jam"], "Toffee")).toEqual(["Berry Jam"]);
  });
});

describe("localStorage round-trip", () => {
  let storage;

  beforeEach(() => {
    storage = freshStorage();
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loadCustom returns an empty array when storage is empty or malformed", () => {
    expect(loadCustom()).toEqual([]);
    storage.setItem(STORAGE_KEY, "not-json");
    expect(loadCustom()).toEqual([]);
    storage.setItem(STORAGE_KEY, JSON.stringify({ not: "an array" }));
    expect(loadCustom()).toEqual([]);
  });

  it("saveCustom writes a JSON array; loadCustom reads it back", () => {
    saveCustom(["Berry Jam", "Toffee"]);
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(["Berry Jam", "Toffee"]),
    );
    expect(loadCustom()).toEqual(["Berry Jam", "Toffee"]);
  });

  it("saveCustom skips built-in tags and normalizes entries defensively", () => {
    saveCustom(["Berry Jam", "  Fruity  ", "", null, "  Spicy  "]);
    expect(loadCustom()).toEqual(["Berry Jam", "Spicy"]);
  });

  it("saveCustom caps the list to MAX_CUSTOM_FLAVORS, keeping the first N", () => {
    const tooMany = Array.from({ length: MAX_CUSTOM_FLAVORS + 5 }, (_, i) => `t${i}`);
    saveCustom(tooMany);
    expect(loadCustom().length).toBe(MAX_CUSTOM_FLAVORS);
  });

  it("saveCustom removes the key when the resulting list is empty", () => {
    saveCustom(["Berry Jam"]);
    saveCustom([]);
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(loadCustom()).toEqual([]);
  });
});

describe("FLAVORS / MAX_CUSTOM_FLAVORS contract", () => {
  it("MAX_CUSTOM_FLAVORS is exactly 20", () => {
    expect(MAX_CUSTOM_FLAVORS).toBe(20);
  });

  it("built-in FLAVORS is non-empty so the chip row always has something", () => {
    expect(FLAVORS.length).toBeGreaterThan(0);
  });
});