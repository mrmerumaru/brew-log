import { describe, it, expect } from "vitest";
import { csvCell } from "./csvCell";

describe("csvCell — nulls and primitives", () => {
  it("returns an empty string for null and undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("stringifies numbers and booleans", () => {
    expect(csvCell(0)).toBe("0");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(true)).toBe("true");
  });
});

describe("csvCell — RFC 4180 quoting", () => {
  it("passes plain strings through untouched", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell("Ethiopia Yirgacheffe")).toBe("Ethiopia Yirgacheffe");
  });

  it("quotes when the value contains a comma", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
  });

  it("quotes when the value contains a double quote, and doubles the inner quote", () => {
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
  });

  it("quotes when the value contains CR or LF", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  });
});

describe("csvCell — formula injection guard", () => {
  // The OWASP CSV Injection cheat sheet lists these as the dangerous lead
  // characters. A leading tab is also dangerous in some spreadsheet apps.
  it("quotes when the value starts with =", () => {
    expect(csvCell("=SUM(A1:A2)")).toBe('"=SUM(A1:A2)"');
  });

  it("quotes when the value starts with +", () => {
    expect(csvCell("+1+1")).toBe('"+1+1"');
  });

  it("quotes when the value starts with -", () => {
    expect(csvCell("-2+3")).toBe('"-2+3"');
  });

  it("quotes when the value starts with @", () => {
    expect(csvCell("@SUM(A1:A2)")).toBe('"@SUM(A1:A2)"');
  });

  it("quotes when the value starts with a tab", () => {
    expect(csvCell("\tcmd")).toBe('"\tcmd"');
  });

  it("quotes when the value starts with CR", () => {
    // CR is dangerous in some apps and also needs RFC 4180 quoting; either
    // path arriving at the same result is fine.
    expect(csvCell("\rmalicious")).toBe('"\rmalicious"');
  });

  it("leaves a leading letter alone", () => {
    // The guard triggers on the *first* character only — "=Hello" is dangerous
    // but "Hello=" is just a string with a trailing equals sign.
    expect(csvCell("note: x=1")).toBe("note: x=1");
  });

  it("combines quoting and formula guard when both apply", () => {
    expect(csvCell('=A1,"hi"')).toBe('"=A1,""hi"""');
  });
});
