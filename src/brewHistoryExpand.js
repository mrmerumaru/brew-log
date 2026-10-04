// Pure helpers for the History page's expand/collapse behavior. The card list
// tracks two pieces of state: `expandedId` (one card, or null) and `expandAll`
// (boolean). These helpers are the only place that interprets them, so the
// React component just dispatches the right transitions.

/**
 * Should this card be showing the expanded view?
 *
 * `expandAll` wins: when it's on, every card is expanded regardless of which
 * one the user explicitly opened. Otherwise it's the accordion: only the
 * card matching `expandedId`.
 */
export function shouldExpand(state, brewId) {
  if (state.expandAll) return true;
  return state.expandedId === brewId;
}

/**
 * What is the new `expandedId` if the user taps a card while NOT in
 * expand-all mode? Tap a different card → switch. Tap the open one → close.
 * Tap when nothing is open → open that one.
 */
export function nextExpandedId(currentExpandedId, tappedId) {
  if (currentExpandedId === tappedId) return null;
  return tappedId;
}

/**
 * Toggle the "expand all" flag. When turning it off, the explicit expandedId
 * is also cleared — the user is now in manual mode and "nothing open" is the
 * right default.
 */
export function toggleExpandAll(state) {
  if (state.expandAll) {
    return { expandAll: false, expandedId: null };
  }
  return { expandAll: true, expandedId: state.expandedId };
}

/**
 * What state should result from tapping a card?
 *
 * - expand-all on, card was explicit → leave expand-all mode, collapse card
 * - expand-all on, card was implicit (not explicit) → leave expand-all, pin
 *   to just this one
 * - expand-all off, card already open → collapse
 * - expand-all off, card not open → open
 */
export function tapCard(state, tappedId) {
  if (state.expandAll) {
    if (state.expandedId === tappedId) {
      // The one card the user singled out — collapsing it leaves nothing open,
      // so dropping expand-all matches the result.
      return { expandAll: false, expandedId: null };
    }
    return { expandAll: false, expandedId: tappedId };
  }
  return { expandAll: false, expandedId: nextExpandedId(state.expandedId, tappedId) };
}
