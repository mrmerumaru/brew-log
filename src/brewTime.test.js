import { describe, it, expect } from "vitest";
import {
  formatBrewTime,
  usesHourTime,
  splitHours,
  joinHours,
  splitSeconds,
  joinSeconds,
} from "./brew";

describe("usesHourTime", () => {
  it("is true for Cold Brew", () => {
    expect(usesHourTime("Cold Brew")).toBe(true);
  });

  it("matches case-insensitively and ignores surrounding space", () => {
    expect(usesHourTime("cold brew")).toBe(true);
    expect(usesHourTime("COLD BREW")).toBe(true);
    expect(usesHourTime("  Cold Brew  ")).toBe(true);
  });

  it("is false for every other built-in method", () => {
    for (const m of [
      "Pourover",
      "Moka Pot",
      "Espresso",
      "Turkish",
      "French Press",
      "AeroPress",
    ]) {
      expect(usesHourTime(m)).toBe(false);
    }
  });

  it("is false for blank or missing methods", () => {
    expect(usesHourTime("")).toBe(false);
    expect(usesHourTime(null)).toBe(false);
    expect(usesHourTime(undefined)).toBe(false);
  });

  it("does not match a method that merely contains 'cold brew'", () => {
    expect(usesHourTime("Cold Brew Concentrate")).toBe(false);
  });
});

describe("splitHours", () => {
  it("returns a blank field when there is no time", () => {
    expect(splitHours(null)).toEqual({ timeHours: "" });
    expect(splitHours(undefined)).toEqual({ timeHours: "" });
  });

  it("converts whole hours", () => {
    expect(splitHours(43200)).toEqual({ timeHours: "12" });
    expect(splitHours(3600)).toEqual({ timeHours: "1" });
    expect(splitHours(64800)).toEqual({ timeHours: "18" });
  });

  it("keeps one decimal place for half hours", () => {
    expect(splitHours(23400)).toEqual({ timeHours: "6.5" });
    expect(splitHours(16200)).toEqual({ timeHours: "4.5" });
  });

  it("rounds to the nearest tenth", () => {
    // 20 minutes is 0.333h -> 0.3
    expect(splitHours(1200)).toEqual({ timeHours: "0.3" });
  });
});

describe("joinHours", () => {
  it("returns null when the field is blank", () => {
    expect(joinHours("")).toBe(null);
    expect(joinHours("   ")).toBe(null);
    expect(joinHours(null)).toBe(null);
    expect(joinHours(undefined)).toBe(null);
  });

  it("returns null for negative hours", () => {
    expect(joinHours("-1")).toBe(null);
  });

  it("converts whole hours to seconds", () => {
    expect(joinHours("12")).toBe(43200);
    expect(joinHours("1")).toBe(3600);
    expect(joinHours("18")).toBe(64800);
  });

  it("converts fractional hours to seconds", () => {
    expect(joinHours("6.5")).toBe(23400);
    expect(joinHours("0.5")).toBe(1800);
  });

  it("round-trips through splitHours for common cold brew times", () => {
    for (const s of [3600, 14400, 23400, 43200, 64800]) {
      const { timeHours } = splitHours(s);
      expect(joinHours(timeHours)).toBe(s);
    }
  });
});

describe("formatBrewTime", () => {
  it("formats short brews as m:ss", () => {
    expect(formatBrewTime(165)).toBe("2:45");
    expect(formatBrewTime(45)).toBe("0:45");
    expect(formatBrewTime(120)).toBe("2:00");
  });

  it("formats an hour or more as hours", () => {
    expect(formatBrewTime(3600)).toBe("1h");
    expect(formatBrewTime(43200)).toBe("12h");
    expect(formatBrewTime(64800)).toBe("18h");
  });

  it("keeps the remainder in minutes when there is one", () => {
    expect(formatBrewTime(5400)).toBe("1h 30m");
    expect(formatBrewTime(23400)).toBe("6h 30m");
  });

  it("returns null for a missing time", () => {
    expect(formatBrewTime(null)).toBe(null);
    expect(formatBrewTime(undefined)).toBe(null);
  });
});

describe("time entry round-trips", () => {
  it("minutes/seconds still round-trip unchanged", () => {
    for (const s of [0, 45, 90, 165, 600]) {
      const { timeMin, timeSec } = splitSeconds(s);
      expect(joinSeconds(timeMin, timeSec)).toBe(s);
    }
  });
});
