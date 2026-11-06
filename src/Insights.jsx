import React, { useMemo } from "react";
import { TOKENS, SANS, MONO, SERIF } from "./tokens";
import { beansLabel } from "./brew";
import { t, useLang, presetLabel } from "./i18n";
import {
  GOOD_RATING,
  MIN_GROUP,
  byDimension,
  bestBrews,
  flavoursOfBest,
  formatParameter,
  parameterContrast,
  summary,
} from "./stats";

// Matches the lettered bands in the form, so the three tabs read as one app.
function Band({ mark, title }) {
  return (
    <div className="bl-band -mx-6 px-6 py-2.5 mb-5 flex items-center gap-3">
      <span
        className="bl-mark flex items-center justify-center w-5 h-5 text-[10px]"
        style={{ fontFamily: MONO, fontWeight: 600 }}
        aria-hidden="true"
      >
        {mark}
      </span>
      <h3
        className="text-[12px] tracking-[0.14em] uppercase"
        style={{ fontFamily: SANS, fontWeight: 700, color: TOKENS.ink }}
      >
        {title}
      </h3>
    </div>
  );
}

function Figure({ label, value, note }) {
  return (
    <div>
      <div
        style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.inkFaint, letterSpacing: "0.1em" }}
      >
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: TOKENS.caramel }}>
        {value}
      </div>
      {note && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.inkFaint }}>{note}</div>
      )}
    </div>
  );
}

/** A grouped average — method, bean, grinder. Thin groups never reach here. */
function Ranking({ mark, title, groups, empty }) {
  return (
    <>
      <Band mark={mark} title={title} />
      {groups.length === 0 ? (
        <p className="mb-7 text-[14px]" style={{ fontFamily: SERIF, color: TOKENS.inkFaint }}>
          {empty}
        </p>
      ) : (
        <div className="mb-7">
          {groups.map((g) => (
            <div
              key={g.value}
              className="flex items-baseline justify-between gap-3 py-2"
              style={{ borderBottom: `1px dashed ${TOKENS.rule}` }}
            >
              <span className="truncate text-[14px]" style={{ fontFamily: SERIF, color: TOKENS.ink }}>
                {g.value}
              </span>
              <span className="shrink-0 flex items-baseline gap-2">
                <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.inkFaint }}>
                  {g.count}
                </span>
                <span
                  style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: TOKENS.caramel }}
                >
                  {g.average.toFixed(1)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function Insights({ brews }) {
  // Subscribing here re-renders the panel on a language switch.
  useLang();
  const rows = useMemo(() => brews ?? [], [brews]);

  const stats = useMemo(() => summary(rows), [rows]);
  const contrast = useMemo(() => parameterContrast(rows), [rows]);
  const flavours = useMemo(() => flavoursOfBest(rows), [rows]);
  const best = useMemo(() => bestBrews(rows), [rows]);
  // Grouped on the raw stored method so "Pourover" and "Seduhan" can never
  // split into two groups; only the displayed value is translated.
  const byMethod = useMemo(
    () => byDimension(rows, (r) => r.method).map((g) => ({ ...g, value: presetLabel(g.value) })),
    [rows],
  );
  const byBeans = useMemo(() => byDimension(rows, (r) => beansLabel(r)), [rows]);
  const byGrinder = useMemo(() => byDimension(rows, (r) => r.grinder), [rows]);

  const card = {
    background: TOKENS.card,
    border: `1px solid ${TOKENS.rule}`,
    boxShadow: "0 1px 2px rgba(32,29,26,0.04)",
  };

  if (stats.total === 0) {
    return (
      <div className="bl-paper w-full max-w-[480px] rounded-sm px-6 py-10" style={card}>
        <p className="text-center text-[14px]" style={{ fontFamily: SERIF, color: TOKENS.inkFaint }}>
          {t("insights.nothingYet")}
        </p>
      </div>
    );
  }

  return (
    <div className="bl-paper w-full max-w-[480px] rounded-sm" style={card}>
      <div className="px-6 pt-6 pb-5" style={{ borderBottom: `2px solid ${TOKENS.caramel}` }}>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Figure label={t("insights.brews")} value={stats.total} />
          <Figure
            label={t("insights.average")}
            value={stats.averageRating ? stats.averageRating.toFixed(1) : "—"}
            note={stats.rated < stats.total ? t("insights.rated", { n: stats.rated }) : null}
          />
          <Figure label={t("insights.goodAndUp", { n: GOOD_RATING })} value={stats.best} />
        </div>
      </div>

      <div className="px-6 py-6">
        <Band mark="A" title={t("insights.bestShareTitle")} />

        {contrast.rows.length === 0 ? (
          <p className="mb-7 text-[14px]" style={{ fontFamily: SERIF, color: TOKENS.inkFaint, lineHeight: 1.6 }}>
            {t("insights.notEnough", {
              min: MIN_GROUP,
              good: GOOD_RATING,
              goodCount: contrast.good,
              restCount: contrast.rest,
            })}
          </p>
        ) : (
          <div className="mb-7">
            <div className="flex items-baseline justify-end gap-6 pb-2">
              <span
                className="w-16 text-right"
                style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.caramel, letterSpacing: "0.08em" }}
              >
                {GOOD_RATING}★+
              </span>
              <span
                className="w-16 text-right"
                style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.inkFaint, letterSpacing: "0.08em" }}
              >
                {t("insights.rest")}
              </span>
            </div>

            {contrast.rows.map((p) => (
              <div
                key={p.key}
                className="flex items-baseline justify-between gap-3 py-2"
                style={{ borderTop: `1px dashed ${TOKENS.rule}` }}
              >
                <span className="text-[14px]" style={{ fontFamily: SERIF, color: TOKENS.ink }}>
                  {t(`stats.${p.key}`)}
                </span>
                <span className="shrink-0 flex items-baseline gap-6">
                  <span
                    className="w-16 text-right"
                    style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: TOKENS.caramel }}
                  >
                    {formatParameter(p, p.good)}
                  </span>
                  <span
                    className="w-16 text-right"
                    style={{ fontFamily: MONO, fontSize: 14, color: TOKENS.inkFaint }}
                  >
                    {formatParameter(p, p.rest)}
                  </span>
                </span>
              </div>
            ))}

            <p
              className="mt-3 text-[12px]"
              style={{ fontFamily: SERIF, color: TOKENS.inkFaint, lineHeight: 1.5 }}
            >
              {t("insights.fromContrast", {
                good: contrast.good,
                rating: GOOD_RATING,
                rest: contrast.rest,
              })}
              {!contrast.grindComparable && t("insights.grindLeftOut", { n: contrast.grinders })}
            </p>
          </div>
        )}

        {flavours.length > 0 && (
          <>
            <Band mark="B" title={t("insights.tastesLikeBest")} />
            <div className="flex flex-wrap gap-2 mb-7">
              {flavours.map((f) => (
                <span
                  key={f.tag}
                  className="px-2.5 py-1 rounded-full text-[12px]"
                  style={{ fontFamily: SERIF, background: TOKENS.espressoSoft, color: TOKENS.espresso }}
                >
                  {presetLabel(f.tag)}
                  <span style={{ fontFamily: MONO, fontSize: 10 }}> {Math.round(f.share * 100)}%</span>
                </span>
              ))}
            </div>
          </>
        )}

        <Ranking
          mark="C"
          title={t("insights.byMethod")}
          groups={byMethod}
          empty={t("insights.noMethod", { n: MIN_GROUP })}
        />
        <Ranking
          mark="D"
          title={t("insights.byBeans")}
          groups={byBeans}
          empty={t("insights.noBag", { n: MIN_GROUP })}
        />
        {byGrinder.length > 0 && (
          <Ranking mark="E" title={t("insights.byGrinder")} groups={byGrinder} empty="" />
        )}

        {best.length > 0 && (
          <>
            <Band mark={byGrinder.length > 0 ? "F" : "E"} title={t("insights.worthRepeating")} />
            <div>
              {best.map((b) => (
                <div
                  key={b.id}
                  className="flex items-baseline justify-between gap-3 py-2"
                  style={{ borderBottom: `1px dashed ${TOKENS.rule}` }}
                >
                  <span className="min-w-0">
                    <span
                      className="text-[14px] block truncate"
                      style={{ fontFamily: SANS, fontWeight: 700, color: TOKENS.ink }}
                    >
                      {b.drink || b.method || t("history.brewFallback")}
                    </span>
                    <span
                      className="text-[12px] block truncate"
                      style={{ fontFamily: SERIF, color: TOKENS.inkFaint }}
                    >
                      {beansLabel(b) ?? t("history.noBean")}
                    </span>
                  </span>
                  <span
                    className="shrink-0"
                    style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: TOKENS.caramel }}
                  >
                    {b.rating}★
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
