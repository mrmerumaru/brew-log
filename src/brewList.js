// Pure helpers for the brew list state shared between App and BrewHistory.
//
// The list lives in App so autocomplete, Insights, and History all read from
// the same source. History is allowed to mutate it (after a delete) and tells
// App via the setBrews callback. These helpers keep the rules predictable
// without scattering filter/sort logic across components.

export function brewListAfterDelete(brews, deletedId) {
  return brews.filter((b) => b.id !== deletedId);
}

// True when the App-level fetch is still in flight (pastBrews === undefined).
// History uses this to render its loading state instead of doing its own
// fetch.
export function isHistoryLoading(pastBrews) {
  return pastBrews === undefined;
}

// True when the user has signed in but has no brews yet.
export function isHistoryEmpty(pastBrews) {
  return Array.isArray(pastBrews) && pastBrews.length === 0;
}