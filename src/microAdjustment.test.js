import { describe, it, expect } from "vitest";
import {
  microAdjustLabel,
  microAdjustmentState,
  microAdjustmentUnitToSave,
  suggestionsFrom,
  num,
} from "./brew";

describe("microAdjustLabel", () => {
  it("is null when no micro-adjustment was recorded", () => {
    expect(microAdjustLabel({})).toBe(null);
    expect(microAdjustLabel({ micro_adjustment: null })).toBe(null);
    expect(microAdjustLabel(null)).toBe(null);
  });

  it("shows the unit when there is one", () => {
    expect(microAdjustLabel({ micro_adjustment: 3, micro_adjustment_unit: "clicks" }))
      .toBe("+3 clicks");
  });

  it("marks the value as an offset from the base setting", () => {
    expect(microAdjustLabel({ micro_adjustment: 3 })).toBe("+3");
    expect(microAdjustLabel({ micro_adjustment: 2.5 })).toBe("+2.5");
  });

  it("keeps a negative offset's sign as-is", () => {
    expect(microAdjustLabel({ micro_adjustment: -2, micro_adjustment_unit: "clicks" }))
      .toBe("-2 clicks");
  });

  it("treats zero as an offset of zero", () => {
    expect(microAdjustLabel({ micro_adjustment: 0, micro_adjustment_unit: "clicks" }))
      .toBe("+0 clicks");
  });

  it("ignores a blank unit", () => {
    expect(microAdjustLabel({ micro_adjustment: 3, micro_adjustment_unit: "   " }))
      .toBe("+3");
  });
});

describe("micro-adjustment is optional", () => {
  it("a blank field parses to null, not zero", () => {
    // Null means "this grinder has no micro-adjustment" — distinguishable
    // from "adjusted by zero", which is a real setting.
    expect(num("")).toBe(null);
    expect(num(undefined)).toBe(null);
    expect(num("0")).toBe(0);
    expect(num("+3")).toBe(3);
    expect(num("-2")).toBe(-2);
    expect(num("2.5")).toBe(2.5);
  });

  it("an absent value loads as an empty form field", () => {
    expect(microAdjustmentState({})).toEqual({
      microAdjustment: "",
      microAdjustmentUnit: "",
    });
    expect(microAdjustmentState(null)).toEqual({
      microAdjustment: "",
      microAdjustmentUnit: "",
    });
  });

  it("a recorded zero loads as zero, not blank", () => {
    expect(microAdjustmentState({ micro_adjustment: 0 }).microAdjustment).toBe("0");
  });

  it("a recorded value loads with its unit", () => {
    expect(
      microAdjustmentState({
        micro_adjustment: 3,
        micro_adjustment_unit: "microns",
      }),
    ).toEqual({ microAdjustment: "3", microAdjustmentUnit: "microns" });
  });
});

describe("the micro-adjustment unit defaults to clicks", () => {
  it("a value with no unit gets clicks", () => {
    expect(microAdjustmentUnitToSave("", "3")).toBe("clicks");
    expect(microAdjustmentUnitToSave("   ", "3")).toBe("clicks");
    expect(microAdjustmentUnitToSave(null, "3")).toBe("clicks");
  });

  it("a value with a custom unit keeps it", () => {
    expect(microAdjustmentUnitToSave("microns", "3")).toBe("microns");
    expect(microAdjustmentUnitToSave("rotations", "-1.5")).toBe("rotations");
  });

  it("a unit is trimmed", () => {
    expect(microAdjustmentUnitToSave("  clicks  ", "3")).toBe("clicks");
  });

  it("no value means no unit — there's nothing to give a unit to", () => {
    expect(microAdjustmentUnitToSave("", "")).toBe(null);
    expect(microAdjustmentUnitToSave("clicks", "")).toBe(null);
    expect(microAdjustmentUnitToSave(null, null)).toBe(null);
  });

  it("a recorded zero is still a value, so it gets the default unit", () => {
    expect(microAdjustmentUnitToSave("", "0")).toBe("clicks");
  });
});

describe("suggestions for the micro-adjustment unit", () => {
  const rows = [
    { micro_adjustment_unit: "microns" },
    { micro_adjustment_unit: "clicks" },
    { micro_adjustment_unit: "microns" },
    { micro_adjustment_unit: null },
    { micro_adjustment_unit: "" },
  ];

  it("collects the distinct units, most recently used first", () => {
    const s = suggestionsFrom(rows);
    expect(s.microAdjustmentUnit).toEqual(["microns", "clicks"]);
  });

  it("skips rows where the unit was never recorded", () => {
    const s = suggestionsFrom(rows);
    expect(s.microAdjustmentUnit).not.toContain("");
    expect(s.microAdjustmentUnit).not.toContain(null);
  });

  it("returns an empty list when nothing was recorded", () => {
    expect(suggestionsFrom([]).microAdjustmentUnit).toEqual([]);
    expect(suggestionsFrom([{ micro_adjustment_unit: null }]).microAdjustmentUnit)
      .toEqual([]);
  });
});
