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