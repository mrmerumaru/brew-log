import React from "react";
import { TOKENS, MONO } from "./tokens";
import { LANGS, LANG_LABELS, LANG_NAMES, setLang, useLang } from "./i18n";
import { t } from "./i18n";

// The language switch: one segmented control, styled the same as the json/csv
// toggle beside it in the header so it reads as the same kind of affordance
// rather than a new one.
//
// Rendered in two places — the header, and the login screen. The login screen
// needs its own because App returns before the header exists when nobody is
// signed in, and someone who reads only Bahasa shouldn't have to sign in
// through an English screen to find the setting.
export default function LanguageToggle() {
  const active = useLang();

  return (
    <div
      role="group"
      aria-label={t("app.language")}
      className="bl-press rounded-full overflow-hidden flex"
      style={{ border: `1px solid ${TOKENS.rule}` }}
    >
      {LANGS.map((code) => {
        const isActive = code === active;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={isActive}
            aria-label={LANG_NAMES[code]}
            title={LANG_NAMES[code]}
            className="px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]"
            style={{
              fontFamily: MONO,
              fontWeight: isActive ? 600 : 400,
              background: isActive ? TOKENS.espressoSoft : "transparent",
              color: isActive ? TOKENS.espresso : TOKENS.inkFaint,
            }}
          >
            {LANG_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
