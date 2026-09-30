import { FLAVORS } from "./tokens";

// Cap on how many custom tags a user can keep in localStorage. Enough room to
// grow without making the chip row unwieldy.
export const MAX_CUSTOM_FLAVORS = 20;

// Bumped when the on-disk shape changes incompatibly. v1 = string[].
const SCHEMA_VERSION = 1;

const KEY_PREFIX = "brew-log:custom-flavors:v";
export const STORAGE_KEY = `${KEY_PREFIX}${SCHEMA_VERSION}`;

const MAX_LEN = 30;

/**
 * Trim, collapse internal whitespace runs, then cap length. Returns null for
 * inputs that can't become a usable tag.
 */
export function normalize(raw) {
  if (typeof raw !== "string") return null;
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) return null;
  if (collapsed.length > MAX_LEN) return null;
  return collapsed;
}

function lowerSet(arr) {
  return new Set(arr.map((s) => s.toLowerCase()));
}

/**
 * True when the tag is something the user added rather than built in. Empty
 * strings and null count as "not built in" — the caller decides what to do.
 */
export function isCustom(tag) {
  if (tag == null || tag === "") return true;
  return !FLAVORS.some((f) => f.toLowerCase() === String(tag).toLowerCase());
}

/**
 * Try to add `raw` to `list`. Returns the new list plus a status:
 *   { added: true, list, reason: "ok" }
 *   { added: false, list, reason: "builtin" | "duplicate" | "cap" | "invalid" }
 *
 * The list is never mutated; the returned list is what should replace it.
 */
export function addCustom(list, raw) {
  const cleaned = normalize(raw);
  if (!cleaned) {
    return { added: false, list, reason: "invalid" };
  }
  const builtins = lowerSet(FLAVORS);
  if (builtins.has(cleaned.toLowerCase())) {
    return { added: false, list, reason: "builtin" };
  }
  const existing = lowerSet(list);
  if (existing.has(cleaned.toLowerCase())) {
    return { added: false, list, reason: "duplicate" };
  }
  if (list.length >= MAX_CUSTOM_FLAVORS) {
    return { added: false, list, reason: "cap" };
  }
  return { added: true, list: [...list, cleaned], reason: "ok" };
}

/** Case-insensitive removal. List is never mutated. */
export function removeCustom(list, tag) {
  const target = String(tag ?? "").toLowerCase();
  if (!target) return list;
  return list.filter((t) => t.toLowerCase() !== target);
}

function safeStorage() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // Some browsers throw on localStorage access (privacy mode, etc.). Treat
    // as "no storage" so the UI still works in-memory.
  }
  return null;
}

/**
 * Read custom tags from localStorage. Returns [] for missing, malformed, or
 * unreadable storage — never throws.
 */
export function loadCustom() {
  const storage = safeStorage();
  if (!storage) return [];
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw == null) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  // Defensive cleanup: drop empties, normalize, drop built-ins, dedupe
  // case-insensitively, cap to MAX_CUSTOM_FLAVORS.
  const seen = lowerSet(FLAVORS);
  const out = [];
  for (const entry of parsed) {
    const cleaned = normalize(entry);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    if (out.some((t) => t.toLowerCase() === key)) continue;
    out.push(cleaned);
    if (out.length >= MAX_CUSTOM_FLAVORS) break;
  }
  return out;
}

/**
 * Persist `customTags` to localStorage. Cleans up defensively before writing,
 * and removes the key entirely when the result is empty so the slot doesn't
 * linger as `[]`.
 */
export function saveCustom(customTags) {
  const storage = safeStorage();
  if (!storage) return;
  const builtins = lowerSet(FLAVORS);
  const seen = new Set();
  const cleaned = [];
  for (const entry of Array.isArray(customTags) ? customTags : []) {
    const norm = normalize(entry);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (builtins.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(norm);
    if (cleaned.length >= MAX_CUSTOM_FLAVORS) break;
  }
  try {
    if (cleaned.length === 0) {
      storage.removeItem(STORAGE_KEY);
    } else {
      storage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
  } catch {
    // Storage full or denied. The UI keeps working off the in-memory state.
  }
}