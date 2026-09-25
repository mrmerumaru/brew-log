// What the log adds up to.
//
// Everything here is a pure function over brew rows, so the arithmetic can be
// tested without a browser — which matters more than usual, because numbers
// presented as insight are believed. The guard rails are the point:
//
//   * a group under MIN_GROUP brews is dropped rather than shown, since two
//     brews is an anecdote and displaying it as an average invites the wrong
//     conclusion;
//   * every figure carries the count it came from;
//   * grind size is only compared within one grinder, because the numbers mean
//     different things on different machines.

// Named stats rather than insights so it can't collide with Insights.jsx on a
// case-insensitive filesystem — that resolves one way on macOS and another on
// the Linux box Vercel builds on, which is a miserable way to find a bug.
//
// Extension spelled out, unlike elsewhere in src/, so this module runs
// straight through Node: its whole reason for being separate is that the
// arithmetic is testable without a browser.
import { num } from "./brew.js";

// Below this, a group is noise rather than a signal.
export const MIN_GROUP = 3;
// What counts as a cup worth repeating.
export const GOOD_RATING = 4;

const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

const rated = (rows) => rows.filter((r) => typeof r?.rating === "number" && r.rating > 0);

/** Headline counts, so every other figure can be read in proportion. */
export function summary(rows = []) {
  const withRating = rated(rows);
  const dates = rows.map((r) => r?.created_at).filter(Boolean).sort();

  return {
    total: rows.length,
    rated: withRating.length,
    averageRating: mean(withRating.map((r) => r.rating)),
    best: withRating.filter((r) => r.rating >= GOOD_RATING).length,
    firstAt: dates[0] ?? null,
    lastAt: dates[dates.length - 1] ?? null,
  };
}

/**
 * Average rating grouped by one field — method, bean, grinder and so on.
 * Groups thinner than MIN_GROUP are dropped, not shown with a caveat: a
 * one-brew "average" of 5 would otherwise top the table forever.
 */
export function byDimension(rows = [], accessor) {
  const groups = new Map();

  for (const row of rated(rows)) {
    const key = accessor(row)?.trim?.() ?? accessor(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.rating);
  }

  return [...groups.entries()]
    .map(([value, ratings]) => ({ value, count: ratings.length, average: mean(ratings) }))
    .filter((g) => g.count >= MIN_GROUP)
    .sort((a, b) => b.average - a.average || b.count - a.count);
}

const ratioOfRow = (r) =>
  r?.dose_g && r?.water_g ? r.water_g / r.dose_g : null;

// The parameters worth contrasting, and how to read one off a row.
const PARAMETERS = [
  { key: "dose", label: "Dose", unit: "g", read: (r) => num(r?.dose_g), decimals: 1 },
  { key: "ratio", label: "Ratio", unit: "", read: ratioOfRow, decimals: 1, prefix: "1:" },
  { key: "temp", label: "Temp", unit: "°C", read: (r) => num(r?.water_temp_c), decimals: 1 },
  { key: "time", label: "Time", unit: "s", read: (r) => num(r?.brew_time_s), decimals: 0 },
  { key: "grind", label: "Grind", unit: "", read: (r) => num(r?.grind_size), decimals: 1 },
];

/**
 * How the good cups differ from the rest, parameter by parameter. This is the
 * question the app exists to answer — "my 4-star brews run three degrees
 * hotter" is actionable in a way that an overall average never is.
 *
 * A parameter is only reported when both sides have enough brews to mean
 * anything.
 */
export function parameterContrast(rows = []) {
  const withRating = rated(rows);
  const good = withRating.filter((r) => r.rating >= GOOD_RATING);
  const rest = withRating.filter((r) => r.rating < GOOD_RATING);

  // Grind numbers are scale-specific: 18 clicks on one grinder and 18 on
  // another aren't the same grind. Only comparable if one grinder is in play.
  const grinders = new Set(
    withRating.map((r) => r?.grinder?.trim()).filter(Boolean),
  );
  const grindComparable = grinders.size <= 1;

  const out = [];
  for (const p of PARAMETERS) {
    if (p.key === "grind" && !grindComparable) continue;

    const g = good.map(p.read).filter((v) => v != null);
    const o = rest.map(p.read).filter((v) => v != null);
    if (g.length < MIN_GROUP || o.length < MIN_GROUP) continue;

    const goodMean = mean(g);
    const restMean = mean(o);
    out.push({
      ...p,
      good: goodMean,
      rest: restMean,
      delta: goodMean - restMean,
      goodCount: g.length,
      restCount: o.length,
    });
  }

  return { rows: out, good: good.length, rest: rest.length, grindComparable, grinders: grinders.size };
}

/** The flavours that turn up most often in the cups you rated highly. */
export function flavoursOfBest(rows = []) {
  const counts = new Map();
  const good = rated(rows).filter((r) => r.rating >= GOOD_RATING);

  for (const row of good) {
    for (const tag of row?.flavor_tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, share: count / (good.length || 1) }))
    .sort((a, b) => b.count - a.count);
}

/** Highest rated first, then most recent — the shortlist worth repeating. */
export function bestBrews(rows = [], limit = 5) {
  return rated(rows)
    .filter((r) => r.rating >= GOOD_RATING)
    .sort((a, b) => b.rating - a.rating || String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
}

/** Format a contrast figure the way its parameter wants to read. */
export function formatParameter(p, value) {
  if (value == null) return "—";
  if (p.key === "time") {
    const total = Math.round(value);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  return `${p.prefix ?? ""}${value.toFixed(p.decimals)}${p.unit}`;
}
