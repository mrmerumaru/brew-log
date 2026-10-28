import { describe, it, expect } from "vitest";
import { CARRY_KEYS, applyCarriedFields } from "./brew";

// Switching method in the form swaps the equipment + bean fields for the
// most recent brew of that method. The fields are applied through a map of
// setters, keyed by carry key.
//
// This used to look setters up by a computed "set<Name>" name, so any carry
// key without a matching setter resolved to undefined and the effect threw
// "is not a function" — blanking the entire form the moment the user
// tapped a different method chip. The tests below pin the map and the
// carry list to each other so that can't happen again silently.

describe("carry-forward keys", () => {
  it("includes the equipment and bean fields", () => {
    expect(CARRY_KEYS).toEqual(
      expect.arrayContaining([
        "machineBrand",
        "machineModel",
        "grinder",
        "grindSize",
        "grindUnit",
        "microAdjustment",
        "microAdjustmentUnit",
        "beanName",
        "beanType",
        "components",
        "origin",
        "process",
        "roast",
      ]),
    );
  });

  it("carries the micro-adjustment with the rest of the grinder setup", () => {
    // The micro-adjustment dial belongs to the grinder, so it has to move
    // with the grinder when the method changes.
    expect(CARRY_KEYS).toContain("microAdjustment");
    expect(CARRY_KEYS).toContain("microAdjustmentUnit");
  });

  it("doesn't carry the fields the method owns", () => {
    // Drink, dose, water, time and milk are per-cup, not per-method.
    for (const key of [
      "drink",
      "dose",
      "water",
      "temp",
      "timeMin",
      "timeSec",
      "timeHours",
      "milkBrand",
      "milkType",
      "pours",
      "rating",
      "notes",
    ]) {
      expect(CARRY_KEYS).not.toContain(key);
    }
  });
});

describe("applying carried fields", () => {
  it("calls the setter for every carry key", () => {
    const calls = {};
    const setters = Object.fromEntries(
      CARRY_KEYS.map((k) => [k, (v) => { calls[k] = v; }]),
    );
    const carried = Object.fromEntries(CARRY_KEYS.map((k) => [k, `value-of-${k}`]));

    const missing = applyCarriedFields(carried, setters);

    expect(missing).toEqual([]);
    expect(calls).toEqual(carried);
  });

  it("carries the micro-adjustment value and its unit", () => {
    const calls = {};
    const setters = Object.fromEntries(
      CARRY_KEYS.map((k) => [k, (v) => { calls[k] = v; }]),
    );

    applyCarriedFields(
      { ...Object.fromEntries(CARRY_KEYS.map((k) => [k, ""])), microAdjustment: "3", microAdjustmentUnit: "clicks" },
      setters,
    );

    expect(calls.microAdjustment).toBe("3");
    expect(calls.microAdjustmentUnit).toBe("clicks");
  });

  it("reports a missing setter by name instead of throwing", () => {
    // The regression: a carry key with no setter used to throw
    // "is not a function", which blanked the form.
    const setters = Object.fromEntries(
      CARRY_KEYS.filter((k) => k !== "microAdjustment").map((k) => [k, () => {}]),
    );

    let missing = null;
    expect(() => {
      missing = applyCarriedFields({}, setters);
    }).not.toThrow();
    expect(missing).toEqual(["microAdjustment"]);
  });

  it("survives a completely empty setter map", () => {
    let missing = null;
    expect(() => {
      missing = applyCarriedFields({}, {});
    }).not.toThrow();
    expect(missing).toEqual(CARRY_KEYS);
  });

  it("survives a missing setter map entirely", () => {
    let missing = null;
    expect(() => {
      missing = applyCarriedFields({}, undefined);
    }).not.toThrow();
    expect(missing).toEqual(CARRY_KEYS);
  });

  it("ignores a non-function value in the map", () => {
    const setters = Object.fromEntries(
      CARRY_KEYS.map((k) => [k, k === "grinder" ? null : () => {}]),
    );

    let missing = null;
    expect(() => {
      missing = applyCarriedFields({}, setters);
    }).not.toThrow();
    expect(missing).toEqual(["grinder"]);
  });
});
