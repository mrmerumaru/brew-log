// Tiny pure helper for the brew-photo lookup table. Extracted so the
// thumbnail logic can be tested without a DOM, and so History, Share, and
// any future view that renders a brew photo all resolve to the same path
// for the same brew.
//
// New brews have a thumb_path; old brews only have photo_path. History
// renders at thumbnail size, so it should always prefer the thumb when
// available. Share (which renders the full photo on the share card) uses
// the full path directly and doesn't go through this helper.

export function thumbLookupPath(brew) {
  if (!brew) return null;
  return brew.thumb_path || brew.photo_path || null;
}

/**
 * Look up a signed URL for a brew's thumbnail path. Returns null when
 * nothing has been signed yet — the caller renders the no-photo
 * placeholder until IntersectionObserver signs it.
 *
 * The cache holds `{url, expiresAt}` entries. An entry that has already
 * expired is treated as absent: rendering a dead URL would show a broken
 * image, which looks worse than the placeholder.
 */
export function lookupThumbUrl(photoUrlCache, brew, now = Date.now()) {
  const path = thumbLookupPath(brew);
  if (!path) return null;
  const entry = photoUrlCache[path];
  if (!entry) return null;
  if (entry.expiresAt != null && entry.expiresAt <= now) return null;
  return entry.url ?? null;
}

/**
 * Which cached URLs are close enough to expiry to re-sign. Kept separate from
 * the cache so the rule is testable without timers.
 *
 * @param {object} cache     path -> {url, expiresAt}
 * @param {string[]} paths   the paths currently worth keeping alive
 * @param {number} now
 * @param {number} slackMs   re-sign this long before expiry
 * @returns {string[]} paths needing a fresh URL
 */
export function pathsNeedingRefresh(cache, paths, now = Date.now(), slackMs = 120000) {
  const out = [];
  for (const path of paths) {
    if (!path) continue;
    const entry = cache[path];
    if (!entry) {
      out.push(path);
      continue;
    }
    if (entry.expiresAt != null && entry.expiresAt - now <= slackMs) out.push(path);
  }
  return out;
}

/**
 * Decide whether a brew at index i should be signed right now. Used after the
 * initial pass: once we've signed the first batch eagerly, this returns true
 * for any brew whose index falls inside the current "visible window plus a
 * small lookahead" window, false otherwise.
 *
 * @param {number} index
 * @param {number} highestVisibleIndex   - largest index currently intersecting the IO (-1 if none)
 * @param {number} lowestVisibleIndex    - smallest index currently intersecting the IO (-1 if none)
 * @param {number} windowPadding         - how many cards past each end to keep signed (default 4)
 */
export function shouldSignOnLazy(
  index,
  highestVisibleIndex,
  lowestVisibleIndex,
  windowPadding = 4,
) {
  if (highestVisibleIndex < 0 || lowestVisibleIndex < 0) {
    return index <= windowPadding;
  }
  return (
    index >= lowestVisibleIndex - windowPadding &&
    index <= highestVisibleIndex + windowPadding
  );
}