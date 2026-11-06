import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STRINGS,
  LANGS,
  LANG_LABELS,
  LANG_NAMES,
  DEFAULT_LANG,
  DEFAULT_LANG as DEFAULT,
  getLang,
  setLang,
  t,
  presetLabel,
  presetOptions,
  brewName,
  localeTag,
} from "./i18n";

const here = dirname(fileURLToPath(import.meta.url));

// The dictionary is large enough that a typo'd key would silently ship as a
// visible "history.noBrewz" on screen. These tests pin the two languages to
// each other and pin every key used in the source to the dictionary, so the
// suite fails on the mistake instead of the user finding it.

afterEach(() => setLang(DEFAULT));

describe("dictionaries", () => {
  it("covers every language", () => {
    expect(Object.keys(STRINGS).sort()).toEqual([...LANGS].sort());
  });

  it("has the same keys in every language", () => {
    const en = Object.keys(STRINGS.en).sort();
    for (const lang of LANGS) {
      if (lang === "en") continue;
      const other = Object.keys(STRINGS[lang]).sort();
      // Report the actual differences — a bare toEqual on two long arrays is
      // unreadable when it fails.
      const missing = en.filter((k) => !other.includes(k));
      const extra = other.filter((k) => !en.includes(k));
      expect({ lang, missing, extra }).toEqual({ lang, missing: [], extra: [] });
    }
  });

  it("has no empty strings", () => {
    const blanks = [];
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(STRINGS[lang])) {
        if (typeof value !== "string" || !value.trim()) blanks.push(`${lang}:${key}`);
      }
    }
    expect(blanks).toEqual([]);
  });

  it("keeps placeholders consistent across languages", () => {
    // A translated string that drops or renames a {placeholder} renders the
    // braces to the user, so the variable sets have to match.
    const vars = (s) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const mismatched = [];
    for (const [key, en] of Object.entries(STRINGS.en)) {
      for (const lang of LANGS) {
        const other = STRINGS[lang]?.[key];
        if (other && JSON.stringify(vars(en)) !== JSON.stringify(vars(other))) {
          mismatched.push(`${lang}:${key}`);
        }
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("labels every language for the switch", () => {
    for (const lang of LANGS) {
      expect(LANG_LABELS[lang]).toBeTruthy();
      expect(LANG_NAMES[lang]).toBeTruthy();
    }
    expect(LANGS).toContain(DEFAULT_LANG);
  });

  it("defines an Intl tag for every language", () => {
    for (const lang of LANGS) {
      const previous = getLang();
      setLang(lang);
      expect(localeTag()).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
      setLang(previous);
    }
  });
});

describe("keys used in the source", () => {
  // Every t("literal") and t(`literal`) in src/, collected from the files
  // themselves. Anything referenced but undefined fails the suite below.
  function referencedKeys() {
    const found = new Set();
    const literal = /(?<![\w.$])t\(\s*"([^"]+)"/g;
    // Template literals with no ${...} are constant keys too.
    const template = /(?<![\w.$])t\(\s*`([^`$]+)`/g;
    for (const file of readdirSync(here)) {
      if (!/\.(js|jsx)$/.test(file)) continue;
      if (/\.test\.jsx?$/.test(file)) continue;
      if (file === "i18n.js") continue; // holds the dictionaries, not usage
      const src = readFileSync(join(here, file), "utf8");
      for (const re of [literal, template]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(src))) found.add(m[1]);
      }
    }
    return found;
  }

  it("every key used in src/ exists in the dictionary", () => {
    const known = new Set(Object.keys(STRINGS.en));
    const unknown = [...referencedKeys()].filter((k) => !known.has(k)).sort();
    expect(unknown).toEqual([]);
  });

  it("translates every stats.js parameter by key", () => {
    // Insights renders the contrast rows as t(`stats.${p.key}`), which the
    // literal scan above can't see — so read the keys out of stats.js.
    const stats = readFileSync(join(here, "stats.js"), "utf8");
    const keys = [...stats.matchAll(/key:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    const missing = keys.filter((k) => !(`stats.${k}` in STRINGS.en)).sort();
    expect(missing).toEqual([]);
    for (const k of keys) {
      expect(STRINGS.id[`stats.${k}`]).toBeTruthy();
    }
  });
});

describe("t()", () => {
  it("translates in the active language", () => {
    setLang("en");
    expect(t("app.tab.history")).toBe("History");
    setLang("id");
    expect(t("app.tab.history")).toBe("Riwayat");
  });

  it("fills placeholders", () => {
    setLang("en");
    expect(t("history.count", { n: 3 })).toBe("3 brews");
  });

  it("fills a placeholder that appears more than once", () => {
    setLang("en");
    expect(t("form.customTagsCap", { n: 12 })).toBe("12/12 CUSTOM TAGS");
  });

  it("leaves a placeholder it has no var for", () => {
    expect(t("history.count")).toBe("{n} brews");
  });

  it("falls back to the key itself when nothing matches", () => {
    // Better a visible key on screen than a blank space: a missing string is
    // then obvious in a screenshot rather than invisible.
    expect(t("does.not.exist")).toBe("does.not.exist");
  });
});

describe("preset values", () => {
  it("translates a stored preset for display", () => {
    setLang("id");
    expect(presetLabel("Iced Latte")).toBe("Latte Es");
    expect(presetLabel("clicks")).toBe("klik");
    expect(presetLabel("Fruity")).toBe("Buah");
  });

  it("leaves English alone", () => {
    setLang("en");
    expect(presetLabel("Iced Latte")).toBe("Iced Latte");
    expect(presetLabel("clicks")).toBe("clicks");
  });

  it("passes through anything that isn't a preset", () => {
    setLang("id");
    // A hand-typed method, a brand, and a user's own flavour tag must survive
    // untouched — this map only knows the built-in vocabulary.
    expect(presetLabel("Elephant Grounds")).toBe("Elephant Grounds");
    expect(presetLabel("Aeropress inverted")).toBe("Aeropress inverted");
    expect(presetLabel("Smells like Sunday")).toBe("Smells like Sunday");
  });

  it("matches a preset regardless of stored casing", () => {
    setLang("id");
    expect(presetLabel("iced latte")).toBe("Latte Es");
    expect(presetLabel("  Coconut ")).toBe("Kelapa");
  });

  it("handles empty and missing values", () => {
    expect(presetLabel(null)).toBeNull();
    expect(presetLabel(undefined)).toBeUndefined();
    expect(presetLabel("")).toBe("");
    expect(presetLabel("   ")).toBe("   ");
  });

  it("keeps the value when labelling options", () => {
    setLang("id");
    const options = presetOptions(["Iced Latte", "Mocha"]);
    expect(options).toEqual([
      { value: "Iced Latte", label: "Latte Es" },
      { value: "Mocha", label: "Mocha" },
    ]);
  });

  it("forgets the previous language's map after a switch", () => {
    setLang("id");
    expect(presetLabel("Iced Latte")).toBe("Latte Es");
    setLang("en");
    expect(presetLabel("Iced Latte")).toBe("Iced Latte");
    setLang("id");
    expect(presetLabel("Iced Latte")).toBe("Latte Es");
  });
});

describe("language switching", () => {
  it("defaults to English when there's no stored choice", () => {
    expect(getLang()).toBe(DEFAULT_LANG);
  });

  it("ignores an unknown language code", () => {
    setLang("id");
    setLang("fr");
    expect(getLang()).toBe("id");
  });

  it("survives a setLang while no storage is available", () => {
    // Node has no localStorage; the switch must still apply for the session
    // rather than throwing on the persistence step.
    expect(() => setLang("id")).not.toThrow();
    expect(getLang()).toBe("id");
  });
});

describe("brewName", () => {
  it("prefers the drink, then the method", () => {
    expect(brewName({ drink: "Latte", method: "Espresso" })).toBe("Latte");
    expect(brewName({ method: "Espresso" })).toBe("Espresso");
  });

  it("falls back to a translated noun rather than an empty string", () => {
    expect(brewName({})).toBe("Brew");
    expect(brewName(null)).toBe("Brew");
    setLang("id");
    expect(brewName({})).toBe("Seduhan");
  });
});
