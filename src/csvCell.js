// Pure CSV cell writer, lifted out of exportData so it can be unit-tested
// without a browser. Quoting follows RFC 4180; the formula-injection guard
// pre-empts Excel / Sheets / Numbers from interpreting a leading =, +, -, @,
// or tab as a formula when the file is opened.

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
const QUOTE_NEEDED = /[",\r\n]/;

/**
 * Returns the string for a single CSV cell.
 *
 * - null / undefined → empty cell
 * - contains `"`, `,`, `\r`, or `\n` → wrapped in double quotes, inner quotes doubled
 * - starts with `=`, `+`, `-`, `@`, tab, or `\r` → also wrapped (formula guard)
 * - everything else → returned as-is (after stringifying non-strings)
 */
export function csvCell(value) {
  if (value == null) return "";
  const s = typeof value === "string" ? value : String(value);
  if (FORMULA_TRIGGERS.test(s) || QUOTE_NEEDED.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
