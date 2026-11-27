// Turning backend errors into sentences a user can act on.
//
// Postgres, PostgREST and Storage errors arrive as developer text:
//
//   new row violates row-level security policy for table "brews"
//   duplicate key value violates unique constraint "brews_pkey"
//   JWT expired
//
// Rendering that in the UI leaks schema details (table and constraint names,
// policy names, column types). The trade is simple: show a fixed sentence,
// keep the raw text in the console for debugging.
//
// Fixed sentences are not less useful to the user, either — "That didn't save.
// Check your connection and try again." is more actionable than the PostgREST
// internal. Only classify on `code` where we have it; the message patterns are
// a fallback for errors that arrive without one.

/**
 * Copy for the cases worth naming. Everything else falls through to `unknown`.
 * Keys are stable ids, not user-facing text — i18n owns the wording.
 */
const KINDS = [
  // Postgres SQLSTATE
  { kind: "auth", test: (e) => e.code === "42501" || /row-level security/i.test(e.message || "") },
  { kind: "duplicate", test: (e) => e.code === "23505" || /duplicate key/i.test(e.message || "") },
  { kind: "invalid", test: (e) => e.code === "23502" || e.code === "23503" || e.code === "22P02" },
  // PostgREST
  { kind: "notFound", test: (e) => e.code === "PGRST116" || /0 rows|no rows/i.test(e.message || "") },
  { kind: "schema", test: (e) => /PGRST2\d\d|schema cache/i.test(String(e.code) + " " + (e.message || "")) },
  // Auth
  { kind: "signedOut", test: (e) => /JWT expired|invalid claim|refresh_token|not authenticated/i.test(`${e.code || ""} ${e.message || ""}`) },
  // Transport
  { kind: "offline", test: (e) => /Failed to fetch|NetworkError|Load failed|network request failed/i.test(e.message || "") },
  { kind: "timeout", test: (e) => /timeout|timed out/i.test(e.message || "") },
  // Storage
  { kind: "tooLarge", test: (e) => /exceeded the maximum allowed size|payload too large|413/i.test(`${e.code || ""} ${e.message || ""}`) },
  { kind: "denied", test: (e) => /permission|not allowed|unauthorized|403/i.test(`${e.code || ""} ${e.message || ""}`) },
];

/**
 * Classify an error into a stable kind. Never throws: an unusable input is
 * simply `unknown`.
 *
 * @param {unknown} err
 * @returns {string} one of auth|duplicate|invalid|notFound|schema|signedOut|
 *                   offline|timeout|tooLarge|denied|unknown
 */
export function classifyError(err) {
  if (!err || typeof err !== "object") return "unknown";
  for (const { kind, test } of KINDS) {
    try {
      if (test(err)) return kind;
    } catch {
      // A hostile getter shouldn't take down error handling.
    }
  }
  return "unknown";
}

/**
 * The i18n key for a classified error's user-facing sentence.
 *
 * @param {unknown} err
 * @returns {string} an `err.*` key that exists in the dictionary
 */
export function errorMessageKey(err) {
  return `err.${classifyError(err)}`;
}

/**
 * Log the raw error where a developer can find it, in one consistent shape.
 * Called by every UI site that replaces the text with a friendly sentence, so
 * nothing is lost — it just stops being shown to the user.
 */
export function logError(context, err) {
  // eslint-disable-next-line no-console
  console.error(`[${context}]`, {
    kind: classifyError(err),
    code: err?.code,
    message: err?.message,
    details: err?.details,
    hint: err?.hint,
  });
}
