import React, { useMemo } from "react";
import { TOKENS, SANS, MONO, SERIF } from "./tokens";
import { beansLabel } from "./brew";
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
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: TOKENS.amber }}>
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
                  style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: TOKENS.amber }}
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
  const rows = useMemo(() => brews ?? [], [brews]);

  const stats = useMemo(() => summary(rows), [rows]);
  const contrast = useMemo(() => parameterContrast(rows), [rows]);
  const flavours = useMemo(() => flavoursOfBest(rows), [rows]);
  const best = useMemo(() => bestBrews(rows), [rows]);
  const byMethod = useMemo(() => byDimension(rows, (r) => r.method), [rows]);
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
          Nothing to read yet. Log a few brews and this fills in.
        </p>
      </div>
    );
  }

  return (
    <div className="bl-paper w-full max-w-[480px] rounded-sm" style={card}>
      <div className="px-6 pt-6 pb-5" style={{ borderBottom: `2px solid ${TOKENS.amber}` }}>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Figure label="BREWS" value={stats.total} />
          <Figure
            label="AVERAGE"
            value={stats.averageRating ? stats.averageRating.toFixed(1) : "—"}
            note={stats.rated < stats.total ? `${stats.rated} rated` : null}
          />
          <Figure label={`${GOOD_RATING}★ AND UP`} value={stats.best} />
        </div>
      </div>

      <div className="px-6 py-6">
        <Band mark="A" title="What your best cups share" />

        {contrast.rows.length === 0 ? (
          <p className="mb-7 text-[14px]" style={{ fontFamily: SERIF, color: TOKENS.inkFaint, lineHeight: 1.6 }}>
            Not enough to compare yet. This needs at least {MIN_GROUP} brews rated{" "}
            {GOOD_RATING}★ or above and {MIN_GROUP} below — you have {contrast.good} and{" "}
            {contrast.rest}. Rating honestly on both sides is what makes the comparison work.
          </p>
        ) : (
          <div className="mb-7">
            <div className="flex items-baseline justify-end gap-6 pb-2">
              <span
                className="w-16 text-right"
                style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.amber, letterSpacing: "0.08em" }}
              >
                {GOOD_RATING}★+
              </span>
              <span
                className="w-16 text-right"
                style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.inkFaint, letterSpacing: "0.08em" }}
              >
                REST
              </span>
            </div>

            {contrast.rows.map((p) => (
              <div
                key={p.key}
                className="flex items-baseline justify-between gap-3 py-2"
                style={{ borderTop: `1px dashed ${TOKENS.rule}` }}
              >
                <span className="text-[14px]" style={{ fontFamily: SERIF, color: TOKENS.ink }}>
                  {p.label}
                </span>
                <span className="shrink-0 flex items-baseline gap-6">
                  <span
                    className="w-16 text-right"
                    style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: TOKENS.amber }}
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
              From {contrast.good} brews at {GOOD_RATING}★ or above against {contrast.rest} below.
              {!contrast.grindComparable &&
                ` Grind is left out — you've used ${contrast.grinders} grinders, and the numbers don't mean the same thing on each.`}
            </p>
          </div>
        )}

        {flavours.length > 0 && (
          <>
            <Band mark="B" title="Tastes like your best" />
            <div className="flex flex-wrap gap-2 mb-7">
              {flavours.map((f) => (
                <span
                  key={f.tag}
                  className="px-2.5 py-1 rounded-full text-[12px]"
                  style={{ fontFamily: SERIF, background: TOKENS.greenSoft, color: TOKENS.green }}
                >
                  {f.tag}
                  <span style={{ fontFamily: MONO, fontSize: 10 }}> {Math.round(f.share * 100)}%</span>
                </span>
              ))}
            </div>
          </>
        )}

        <Ranking
          mark="C"
          title="By method"
          groups={byMethod}
          empty={`No method has ${MIN_GROUP} rated brews yet.`}
        />
        <Ranking
          mark="D"
          title="By beans"
          groups={byBeans}
          empty={`No bag has ${MIN_GROUP} rated brews yet.`}
        />
        {byGrinder.length > 0 && (
          <Ranking mark="E" title="By grinder" groups={byGrinder} empty="" />
        )}

        {best.length > 0 && (
          <>
            <Band mark={byGrinder.length > 0 ? "F" : "E"} title="Worth repeating" />
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
                      {b.drink || b.method || "Brew"}
                    </span>
                    <span
                      className="text-[12px] block truncate"
                      style={{ fontFamily: SERIF, color: TOKENS.inkFaint }}
                    >
                      {beansLabel(b) ?? "No bean recorded"}
                    </span>
                  </span>
                  <span
                    className="shrink-0"
                    style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: TOKENS.amber }}
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
