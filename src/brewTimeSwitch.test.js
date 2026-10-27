import { describe, it, expect } from "vitest";
import {
  usesHourTime,
  splitHours,
  joinHours,
  splitSeconds,
  joinSeconds,
  formatBrewTime,
} from "./brew";

// The form stores brew time in two shapes: a minutes/seconds pair for most
// methods, and a single hours value for cold brew. These tests pin the
// conversions that happen when the user switches method, which is where the
// two shapes have to meet without losing the user's time.

describe("switching method changes the time unit", () => {
  const coldBrew = {
    id: "cold-1",
    method: "Cold Brew",
    brew_time_s: 43200, // 12h
  };
  const pourover = {
    id: "pour-1",
    method: "Pourover",
    brew_time_s: 165, // 2:45
  };

  it("carries a cold brew's time into the hours field", () => {
    const { timeHours } = splitHours(coldBrew.brew_time_s);
    expect(timeHours).toBe("12");
    expect(joinHours(timeHours)).toBe(43200);
  });

  it("carries a pourover's time into the minutes/seconds pair", () => {
    const { timeMin, timeSec } = splitSeconds(pourover.brew_time_s);
    expect(timeMin).toBe("2");
    expect(timeSec).toBe("45");
    expect(joinSeconds(timeMin, timeSec)).toBe(165);
  });

  it("a cold brew switched to pourover keeps the same duration in m:ss", () => {
    // 12h expressed in minutes and seconds — the same wall-clock time.
    const { timeMin, timeSec } = splitSeconds(coldBrew.brew_time_s);
    expect(joinSeconds(timeMin, timeSec)).toBe(43200);
    expect(timeMin).toBe("720");
    expect(timeSec).toBe("0");
  });

  it("a pourover switched to cold brew keeps the same duration in hours", () => {
    const { timeHours } = splitHours(pourover.brew_time_s);
    expect(timeHours).toBe("0");
    expect(joinHours(timeHours)).toBe(0);
  });

  it("keeps a half-hour cold brew exact through the hours field", () => {
    const { timeHours } = splitHours(23400);
    expect(timeHours).toBe("6.5");
    expect(joinHours(timeHours)).toBe(23400);
  });
});

describe("the hours field only applies to cold brew", () => {
  it("is off for every method that brews in minutes", () => {
    expect(usesHourTime("Pourover")).toBe(false);
    expect(usesHourTime("Espresso")).toBe(false);
    expect(usesHourTime("AeroPress")).toBe(false);
  });

  it("is on for cold brew, however it was spelled", () => {
    expect(usesHourTime("Cold Brew")).toBe(true);
    expect(usesHourTime("cold brew")).toBe(true);
  });
});

describe("displaying a long brew", () => {
  it("shows hours rather than a wall of minutes", () => {
    expect(formatBrewTime(43200)).toBe("12h");
    expect(formatBrewTime(64800)).toBe("18h");
  });

  it("keeps minutes and seconds for a normal brew", () => {
    expect(formatBrewTime(165)).toBe("2:45");
  });

  it("round-trips a cold brew from seconds to hours and back", () => {
    const { timeHours } = splitHours(43200);
    expect(joinHours(timeHours)).toBe(43200);
    expect(formatBrewTime(joinHours(timeHours))).toBe("12h");
  });
});
