// Pure helpers shared by BrewForm and BrewHistory. No React, no Supabase —
// safe to import from anywhere and easy to reason about in isolation.

// Brew time is entered as two separate numeric inputs rather than one "m:ss"
// text field: typing a colon on a phone means switching keyboard layouts and
// back, which is a real hassle several times a day. Two number pads, no colon.

/** Seconds -> the pair of form fields. */
export function splitSeconds(total) {
  if (total == null) return { timeMin: "", timeSec: "" };
  return { timeMin: String(Math.floor(total / 60)), timeSec: String(total % 60) };
}

/**
 * The pair of form fields -> seconds. Null only when both are blank, so the
 * column stays null rather than 0 for an unrecorded time.
 *
 * Seconds over 59 roll up naturally (90 in the seconds box is 1:30), so there's
 * no need to do the division yourself for a long brew.
 */
export function joinSeconds(minutes, seconds) {
  const m = parseInt(String(minutes ?? "").trim(), 10);
  const s = parseInt(String(seconds ?? "").trim(), 10);
  const hasM = Number.isFinite(m);
  const hasS = Number.isFinite(s);

  if (!hasM && !hasS) return null;

  const mm = hasM ? m : 0;
  const ss = hasS ? s : 0;
  if (mm < 0 || ss < 0) return null;

  return mm * 60 + ss;
}

// Seconds -> "m:ss", for display in history and on the share card.
// Brews over an hour read as hours instead: "720:00" is technically right
// but nobody thinks in 720 minutes, and a cold brew's whole point is the
// long steep.
export function formatBrewTime(seconds) {
  if (seconds == null) return null;
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Methods whose brew time is entered in hours rather than minutes and
// seconds. A cold brew steep for 12-18 hours — "12:00:00" in a
// minutes/seconds field is unusable.
export const HOUR_METHODS = ["Cold Brew"];

/**
 * Does this method use an hours field instead of the minutes/seconds pair?
 * Matches case-insensitively so a hand-typed "cold brew" counts too.
 */
export function usesHourTime(method) {
  if (!method) return false;
  const m = String(method).trim().toLowerCase();
  return HOUR_METHODS.some((h) => h.toLowerCase() === m);
}

/** Seconds -> the hours field value (whole hours, rounded to 1dp). */
export function splitHours(total) {
  if (total == null) return { timeHours: "" };
  const hours = Math.round((total / 3600) * 10) / 10;
  return { timeHours: String(hours) };
}

/**
 * The hours field -> seconds. Null only when blank, so the column stays
 * null rather than 0 for an unrecorded time.
 *
 * Tenths of an hour are allowed (6.5h = 6h30m), because a half-hour
 * difference is exactly the kind of thing a cold-brew recipe cares about.
 */
export function joinHours(hours) {
  const h = parseFloat(String(hours ?? "").trim());
  if (!Number.isFinite(h)) return null;
  if (h < 0) return null;
  return Math.round(h * 3600);
}

// The implementation guides hardcode ".jpg"; derive the real extension so a
// PNG or HEIC upload isn't stored under a misleading name.
export function fileExtension(file) {
  const fromName = file?.name?.includes(".") ? file.name.split(".").pop() : null;
  if (fromName && /^[a-z0-9]{1,5}$/i.test(fromName)) return fromName.toLowerCase();
  const fromType = file?.type?.split("/")[1];
  if (fromType && /^[a-z0-9]{1,5}$/i.test(fromType)) return fromType.toLowerCase();
  return "jpg";
}

// An empty date input yields "", which Postgres rejects for a date column.
export function dateOrNull(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? null : trimmed;
}

/**
 * Days between the roast date and when the brew was made — the number coffee
 * people actually care about. Deliberately measured against the brew's own
 * timestamp, not today, so a brew logged last month still reports how fresh the
 * beans were at the time.
 *
 * Returns null when there's no roast date, or when it postdates the brew (a
 * typo rather than something worth displaying).
 */
export function daysOffRoast(roastDate, brewedAt) {
  if (!roastDate) return null;

  // `${date}T00:00:00` parses as local midnight; a bare "YYYY-MM-DD" would be
  // read as UTC and land a day out for anyone west of Greenwich.
  const roast = new Date(`${roastDate}T00:00:00`);
  if (Number.isNaN(roast.getTime())) return null;

  const brewed = brewedAt ? new Date(brewedAt) : new Date();
  if (Number.isNaN(brewed.getTime())) return null;

  // Compare calendar days in local time, so a late-evening brew doesn't round
  // to an extra day.
  const brewedMidnight = new Date(brewed.getFullYear(), brewed.getMonth(), brewed.getDate());
  const days = Math.round((brewedMidnight - roast) / 86400000);

  return days < 0 ? null : days;
}

// parseFloat("") is NaN, which Postgres rejects for a numeric column.
export function num(value) {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

// --- Pour schedule (pourover only) ----------------------------------------

export const MAX_POURS = 8;
export const BLANK_POUR = { timeMin: "", timeSec: "", water: "" };

export function poursFromBrew(brew) {
  const raw = Array.isArray(brew?.pours) ? brew.pours : [];
  const rows = raw.map((p) => ({
    ...splitSeconds(p?.time_s ?? null),
    water: p?.water_g == null ? "" : String(p.water_g),
  }));
  // Pour 1 always exists: a pourover has at least one.
  return rows.length ? rows : [{ ...BLANK_POUR }];
}

/** Form rows -> what gets stored. Drops rows with neither a time nor a volume. */
export function poursToPayload(pours = []) {
  const cleaned = pours
    .map((p) => ({
      time_s: joinSeconds(p?.timeMin, p?.timeSec),
      water_g: num(p?.water),
    }))
    .filter((p) => p.time_s != null || p.water_g != null);

  return cleaned.length ? cleaned : null;
}

/**
 * Running totals, index-aligned with the rows. Each pour stores only its own
 * volume, so the cumulative figure is derived here — that way editing pour 2
 * can't leave a stale total on pour 3.
 */
export function pourTotals(pours = []) {
  let running = 0;
  return pours.map((p) => {
    running += num(p?.water) ?? 0;
    return running;
  });
}

export function pourTotal(pours = []) {
  const totals = pourTotals(pours);
  return totals.length ? totals[totals.length - 1] : 0;
}

/** "0:00 50g · 0:45 100g · 1:30 100g", or null when there's no schedule. */
export function poursLabel(brew) {
  const parts = (Array.isArray(brew?.pours) ? brew.pours : [])
    .map((p) =>
      [formatBrewTime(p?.time_s), p?.water_g == null ? null : `${p.water_g}g`]
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean);

  return parts.length ? parts.join(" · ") : null;
}

// --- Blends ---------------------------------------------------------------
// A blend is stored as an array on `blend_components`; a single origin uses the
// flat bean_name / origin / process columns. Only one of the two is ever
// populated, so there's no chance of the pair disagreeing.

export const MAX_BLEND_COMPONENTS = 5;
export const BLANK_COMPONENT = { name: "", origin: "", process: "", percent: "" };

export function componentsFromBrew(brew) {
  const raw = Array.isArray(brew?.blend_components) ? brew.blend_components : [];
  const rows = raw.map((c) => ({
    name: c?.name ?? "",
    origin: c?.origin ?? "",
    process: c?.process ?? "",
    percent: c?.percent == null ? "" : String(c.percent),
  }));
  // Two blank rows is the useful starting point — a blend of one isn't a blend.
  return rows.length ? rows : [{ ...BLANK_COMPONENT }, { ...BLANK_COMPONENT }];
}

/** Form rows -> what gets stored. Drops entirely blank rows; null if none left. */
export function componentsToPayload(components = []) {
  const cleaned = components
    .map((c) => ({
      name: (c?.name ?? "").trim(),
      origin: (c?.origin ?? "").trim(),
      process: (c?.process ?? "").trim(),
      percent: num(c?.percent),
    }))
    .filter((c) => c.name || c.origin || c.process || c.percent != null);

  return cleaned.length ? cleaned : null;
}

/** Sum of the percentages actually filled in, for the running total. */
export function percentTotal(components = []) {
  return components.reduce((sum, c) => {
    const p = num(c?.percent);
    return p == null ? sum : sum + p;
  }, 0);
}

/**
 * The beans in a blend: "Brazil (50%), Aceh Gayo (50%)". Null when this isn't a
 * blend. The roastery is NOT included — it lives on `bean_name` and applies to
 * the whole bag, so the card can put it on its own line.
 *
 * Origin wins when both it and a lot name are given; the lot name is only a
 * fallback for a component with no origin recorded.
 */
export function blendLabel(brew) {
  const parts = (Array.isArray(brew?.blend_components) ? brew.blend_components : [])
    .map((c) => {
      const who = c?.origin?.trim() || c?.name?.trim() || "";
      const pct = c?.percent == null ? "" : `(${c.percent}%)`;
      return [who, pct].filter(Boolean).join(" ");
    })
    .filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

/** Just the beans, without the roastery: an origin, or a blend's components. */
export function originLabel(brew) {
  return blendLabel(brew) ?? brew?.origin?.trim() ?? null;
}

/** Roastery plus beans on one line, for the history card. */
export function beansLabel(brew) {
  const parts = [brew?.bean_name?.trim(), originLabel(brew)].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// "Greenfields · Fresh Milk", or just whichever half was filled in. Null when
// there's no milk, so callers can hide the line entirely.
export function milkLabel(brew) {
  const parts = [brew?.milk_brand, brew?.milk_type].map((p) => p?.trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// "18 clicks", or just "18" if no unit was recorded. Null when there's no
// grind size, so callers can omit the field.
export function grindLabel(brew) {
  if (brew?.grind_size == null) return null;
  const unit = brew.grind_unit?.trim();
  return unit ? `${brew.grind_size} ${unit}` : String(brew.grind_size);
}

// "+3 clicks" for the grinder's micro-adjustment dial, or null when the brew
// doesn't record one. The sign is part of the meaning — a micro-adjustment
// of -2 clicks is finer than the base setting, +2 is coarser.
export function microAdjustLabel(brew) {
  if (brew?.micro_adjustment == null) return null;
  const unit = brew.micro_adjustment_unit?.trim();
  const value = String(brew.micro_adjustment);
  const signed = value.startsWith("-") ? value : `+${value}`;
  return unit ? `${signed} ${unit}` : signed;
}

// Form-state view of the micro-adjustment fields. A blank form field maps to
// "", so "not recorded" stays distinct from a recorded zero.
export function microAdjustmentState(brew) {
  return {
    microAdjustment:
      brew?.micro_adjustment == null ? "" : String(brew.micro_adjustment),
    microAdjustmentUnit: brew?.micro_adjustment_unit ?? "",
  };
}

export function ratioOf(brew) {
  if (!brew.dose_g || !brew.water_g) return null;
  return `1 : ${(brew.water_g / brew.dose_g).toFixed(1)}`;
}

// Distinct non-empty values per text field, most-recently-used first, for the
// form's autocomplete. Derived from brews you've already logged, so there's no
// separate preset table to keep in sync.
export function suggestionsFrom(rows = []) {
  const fields = {
    drink: "drink",
    method: "method",
    machineBrand: "machine_brand",
    machineModel: "machine_model",
    grinder: "grinder",
    grindUnit: "grind_unit",
    microAdjustmentUnit: "micro_adjustment_unit",
    beanName: "bean_name",
    origin: "origin",
    milkBrand: "milk_brand",
    milkType: "milk_type",
  };

  const out = {};
  for (const [key, column] of Object.entries(fields)) {
    // Keyed case-insensitively so "Iced Latte" and "iced latte" don't both
    // appear; rows arrive newest-first, so the first sighting wins and the
    // spelling you used most recently is the one offered.
    const seen = new Map();
    for (const row of rows) {
      const value = row?.[column]?.trim();
      if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);

      // Bean names and origins also live inside blends. Without this, an origin
      // you've only ever used in a blend wouldn't autocomplete.
      if (key === "beanName" || key === "origin") {
        const field = key === "beanName" ? "name" : "origin";
        for (const c of Array.isArray(row?.blend_components) ? row.blend_components : []) {
          const nested = c?.[field]?.trim();
          if (nested && !seen.has(nested.toLowerCase())) {
            seen.set(nested.toLowerCase(), nested);
          }
        }
      }
    }
    out[key] = [...seen.values()];
  }
  return out;
}

// Pick which brew the form should pre-fill from. New brews are usually the
// same setup as the last one, but the "last one" shouldn't mean "the most
// recent by created_at regardless of method" — that breaks the day a user
// alternates between Espresso and Pourover, where the Espresso equipment
// would land in the Pourover form.
//
// Pass the method the user is about to brew (or null/empty for "I don't
// know yet" — falls back to the most recent of any method). The list is
// assumed to be ordered newest-first, which is what App.jsx already passes
// in.
/**
 * Are these two method names the same method? Case- and space-insensitive,
 * because the method is often typed by hand and the casing shouldn't decide
 * whether a saved brew is treated as a match.
 */
export function sameMethod(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export function pickCarryForward(brews, method) {
  if (!Array.isArray(brews) || brews.length === 0) return null;
  if (!method) return brews[0];
  // Case-insensitive, so a hand-typed "cold brew" finds the built-in
  // "Cold Brew" row (and vice versa). Methods are user-typed text as
  // often as they're picked from the chip list, and the casing shouldn't
  // decide whether the previous setup is carried forward.
  const match = brews.find((b) => b && sameMethod(b.method, method));
  return match ?? brews[0];
}

// Object URLs need revoking; remote signed URLs must be left alone. When
// editing, the preview starts as a signed URL from Storage and only becomes a
// blob: URL if the user picks a replacement file.
export function isObjectUrl(url) {
  return typeof url === "string" && url.startsWith("blob:");
}
