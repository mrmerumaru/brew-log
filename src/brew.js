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
export function formatBrewTime(seconds) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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
    }
    out[key] = [...seen.values()];
  }
  return out;
}

// Object URLs need revoking; remote signed URLs must be left alone. When
// editing, the preview starts as a signed URL from Storage and only becomes a
// blob: URL if the user picks a replacement file.
export function isObjectUrl(url) {
  return typeof url === "string" && url.startsWith("blob:");
}
