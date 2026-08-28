// Pure helpers shared by BrewForm and BrewHistory. No React, no Supabase —
// safe to import from anywhere and easy to reason about in isolation.

// The Time field is labelled "min" and defaults to "2:45", so:
//   "2:45" -> 165s   (m:ss, the common case)
//   "2.5"  -> 150s   (bare number = decimal minutes, matching the label)
// Returns null for anything unparseable, so the column stays null rather than 0.
export function parseBrewTime(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const value = String(raw).trim();
  if (!value) return null;

  if (value.includes(":")) {
    const [m, s] = value.split(":");
    const minutes = parseInt(m, 10);
    const seconds = parseInt(s, 10);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return minutes * 60 + seconds;
  }

  const minutes = parseFloat(value);
  if (Number.isNaN(minutes)) return null;
  return Math.round(minutes * 60);
}

// Inverse of parseBrewTime, for display and for refilling the form when editing.
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

// parseFloat("") is NaN, which Postgres rejects for a numeric column.
export function num(value) {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function ratioOf(brew) {
  if (!brew.dose_g || !brew.water_g) return null;
  return `1 : ${(brew.water_g / brew.dose_g).toFixed(1)}`;
}

// Object URLs need revoking; remote signed URLs must be left alone. When
// editing, the preview starts as a signed URL from Storage and only becomes a
// blob: URL if the user picks a replacement file.
export function isObjectUrl(url) {
  return typeof url === "string" && url.startsWith("blob:");
}
