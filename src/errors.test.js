import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { classifyError, errorMessageKey, logError } from "./errors";
import { STRINGS } from "./i18n";

// The audit finding (F07) was that raw backend text reached the UI: PostgREST
// and Postgres messages name tables, columns, constraints and policies. The
// rule these tests pin is that a classified error always maps to a sentence
// that exists in the dictionary, for both languages.

const pg = (code, message) => ({ code, message });

describe("classifyError", () => {
  it("maps SQLSTATE codes", () => {
    expect(classifyError(pg("42501", "new row violates row-level security policy"))).toBe("auth");
    expect(classifyError(pg("23505", "duplicate key value violates unique constraint"))).toBe("duplicate");
    expect(classifyError(pg("23502", "null value in column violates not-null"))).toBe("invalid");
    expect(classifyError(pg("22P02", "invalid input syntax for type integer"))).toBe("invalid");
  });

  it("maps PostgREST codes", () => {
    expect(classifyError(pg("PGRST116", "JSON object requested, multiple (or no) rows returned"))).toBe("notFound");
    expect(classifyError(pg("PGRST205", "Could not find the table in the schema cache"))).toBe("schema");
  });

  it("maps auth failures", () => {
    expect(classifyError(pg(undefined, "JWT expired"))).toBe("signedOut");
    expect(classifyError(pg(undefined, "not authenticated"))).toBe("signedOut");
  });

  it("maps transport failures", () => {
    expect(classifyError(new TypeError("Failed to fetch"))).toBe("offline");
    expect(classifyError(pg(undefined, "Load failed"))).toBe("offline");
    expect(classifyError(pg(undefined, "request timed out"))).toBe("timeout");
  });

  it("maps storage failures", () => {
    expect(classifyError(pg("413", "The object exceeded the maximum allowed size"))).toBe("tooLarge");
    expect(classifyError(pg(undefined, "new row violates row-level security policy"))).toBe("auth");
  });

  it("falls back to unknown rather than guessing", () => {
    expect(classifyError(pg(undefined, "something strange happened"))).toBe("unknown");
    expect(classifyError(null)).toBe("unknown");
    expect(classifyError("a string, not an error")).toBe("unknown");
    expect(classifyError({})).toBe("unknown");
  });

  it("survives a throwing getter", () => {
    const hostile = {
      get message() {
        throw new Error("nope");
      },
    };
    // The point is that it returns rather than propagating.
    expect(typeof classifyError(hostile)).toBe("string");
  });
});

describe("errorMessageKey", () => {
  it("produces a key that exists in every language", () => {
    for (const err of [
      pg("42501", "row-level security"),
      pg("23505", "duplicate key"),
      pg("PGRST116", "no rows"),
      new TypeError("Failed to fetch"),
      null,
    ]) {
      const key = errorMessageKey(err);
      expect(STRINGS.en[key], `missing EN ${key}`).toBeTruthy();
      expect(STRINGS.id[key], `missing ID ${key}`).toBeTruthy();
      // Nothing may interpolate a raw backend message.
      expect(STRINGS.en[key]).not.toContain("{msg}");
      expect(STRINGS.id[key]).not.toContain("{msg}");
    }
  });

  it("never returns developer text", () => {
    const key = errorMessageKey(pg("42501", "new row violates row-level security policy for table \"brews\""));
    expect(STRINGS.en[key]).not.toMatch(/row-level|policy|table/i);
  });
});

describe("logError", () => {
  let spy;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it("keeps the raw detail in the console", () => {
    logError("brew.save", pg("23505", 'duplicate key value violates unique constraint "brews_pkey"'));
    expect(spy).toHaveBeenCalledTimes(1);
    const [ctx, detail] = spy.mock.calls[0];
    expect(ctx).toBe("[brew.save]");
    expect(detail.code).toBe("23505");
    expect(detail.message).toContain("brews_pkey");
  });

  it("does not throw on a null error", () => {
    expect(() => logError("x", null)).not.toThrow();
  });
});
