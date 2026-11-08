import React, { useId } from "react";
import { TOKENS, MONO } from "./tokens";
import { LANGS, LANG_LABELS, LANG_NAMES, setLang, useLang, t } from "./i18n";

// The language switch: one segmented control, styled the same as the json/csv
// toggle beside it in the header so it reads as the same kind of affordance
// rather than a new one.
//
// Rendered in two places — the header, and the login screen. The login screen
// needs its own because App returns before the header exists when nobody is
// signed in, and someone who reads only Bahasa shouldn't have to sign in
// through an English screen to find the setting.
//
// Each segment carries a flag because "EN | ID" alone reads as another format
// toggle — it sits in the same row, in the same shape, as the json/csv one. The
// flag says "language" before the label is read.

// Drawn as inline SVG rather than the flag emoji: Android and iOS render 🇬🇧 as
// a flag, but Windows and several Android WebViews fall back to the letters
// "GB" — which would put the user back where they started, staring at an
// unexplained two-letter code. SVG renders the same everywhere.
//
// Both flags are cropped to a circle, so the corners of the real rectangles are
// cut away. At 13px that is what makes them read as flags rather than as two
// more bordered chips.
const FLAGS = {
  // Simplified Union Jack. The real flag's saltire is counterchanged so no
  // diagonal is a mirror of its opposite; at 13px that offset is invisible, so
  // this is the symmetric version — which is what every small rendering of it
  // does. Drawn back to front: saltires, then the St George cross over them.
  en: (
    <>
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0 24 24M24 0 0 24" stroke="#FFFFFF" strokeWidth="5" />
      <path d="M0 0 24 24M24 0 0 24" stroke="#C8102E" strokeWidth="2.5" />
      <path d="M12 0v24M0 12h24" stroke="#FFFFFF" strokeWidth="8" />
      <path d="M12 0v24M0 12h24" stroke="#C8102E" strokeWidth="5" />
    </>
  ),
  // Red over white, in halves. The red band alone identifies it at this size —
  // the white half is what needs the ring below to stay visible against the
  // cream card.
  id: (
    <>
      <rect width="24" height="12" fill="#CE1126" />
      <rect y="12" width="24" height="12" fill="#FFFFFF" />
    </>
  ),
};

function Flag({ code }) {
  // useId, not a literal id: the component renders in the header *and* on the
  // login screen, and duplicate SVG ids are invalid markup that would make the
  // clip path resolve by document order.
  const clipId = `bl-flag-${useId()}`;

  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="12" cy="12" r="12" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{FLAGS[code]}</g>
      {/* A hairline ring, so the white band of the Indonesian flag doesn't
          dissolve into the card behind it. */}
      <circle cx="12" cy="12" r="11.5" fill="none" stroke={TOKENS.rule} strokeWidth="1" />
    </svg>
  );
}

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
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]"
            style={{
              fontFamily: MONO,
              fontWeight: isActive ? 600 : 400,
              background: isActive ? TOKENS.espressoSoft : "transparent",
              color: isActive ? TOKENS.espresso : TOKENS.inkFaint,
            }}
          >
            <Flag code={code} />
            {LANG_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
