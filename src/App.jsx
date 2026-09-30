import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import BrewForm from "./BrewForm";
import BrewHistory from "./BrewHistory";
import Insights from "./Insights";
import { TOKENS, SANS, MONO } from "./tokens";
import { suggestionsFrom } from "./brew";
import { IS_PRODUCTION } from "./env";
import { downloadExport } from "./exportData";

// Columns the form needs for carry-forward and autocomplete, plus the two
// Insights reads. Deliberately not `*` — notes and photo_path aren't used by
// either and would just add weight.
const SETUP_COLUMNS =
  "id,created_at,drink,method,machine_brand,machine_model,grinder,bean_name,bean_type,blend_components,origin,process,roast_level,roast_date,milk_brand,milk_type,grind_size,grind_unit,dose_g,water_g,water_temp_c,brew_time_s,pours,rating,flavor_tags";

function Tab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bl-press bl-quiet px-4 py-2 text-[12px] uppercase tracking-[0.1em]"
      style={{
        fontFamily: SANS,
        fontWeight: 700,
        color: active ? TOKENS.green : TOKENS.inkFaint,
        borderBottom: `2px solid ${active ? TOKENS.green : "transparent"}`,
      }}
    >
      {label}
    </button>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState("log");
  // Bumped on every successful save so the history list refetches when opened.
  const [refreshKey, setRefreshKey] = useState(0);
  // What the Log tab is showing:
  //   null                          a new brew, carried forward from the latest
  //   { mode: "edit",   brew, … }   changing a saved brew in place
  //   { mode: "repeat", brew }      a new brew, carried forward from THAT one
  // One field rather than two flags, so "editing" and "repeating" can't both
  // be true. photoUrl is the signed URL the history card already fetched,
  // reused as the edit preview so the form needn't sign it again.
  const [source, setSource] = useState(null);
  const editing = source?.mode === "edit" ? source : null;
  // undefined = still loading, null = no brews yet. The form waits for this so
  // its initial field values are right on first render rather than flashing
  // blank and then filling in.
  const [pastBrews, setPastBrews] = useState(undefined);

  // Which format the Export button next to Sign out produces. JSON is the
  // safer default — round-trippable and the user can convert to CSV in a
  // spreadsheet if they want. Resets on reload (no localStorage).
  const [exportFormat, setExportFormat] = useState("json");

  const startEdit = (brew, photoUrl) => {
    setSource({ mode: "edit", brew, photoUrl: photoUrl ?? null });
    setTab("log");
  };

  // Same setup, fresh cup: the brew is handed over as the carry-forward source
  // rather than as the row being edited, so saving writes a new row and the
  // tasting notes and photo start empty.
  const startRepeat = (brew) => {
    setSource({ mode: "repeat", brew });
    setTab("log");
  };

  const finishEdit = () => {
    setSource(null);
    setTab("history");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setPastBrews(undefined);
      return;
    }
    let cancelled = false;
    supabase
      .from("brews")
      .select(SETUP_COLUMNS)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        // A failure here only costs autocomplete, so fall back to "no history"
        // rather than blocking the form behind an error.
        if (!cancelled) setPastBrews(data ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey]);

  // Switching tabs (or starting an edit / repeat, which also flips the tab)
  // takes you to a fresh view — start it at the top. Instant rather than
  // smooth so it doesn't race the form's slide animation between steps.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [tab]);

  const shell = (children) => (
    <div
      style={{ background: TOKENS.paper, minHeight: "100vh" }}
      className="bl-paper w-full flex flex-col items-center py-10 px-4"
    >
      {children}
    </div>
  );

  if (checkingSession) return shell(null);
  if (!session) return shell(<Login />);

  return shell(
    <>
      <div
        className="w-full max-w-[480px] flex items-center justify-between mb-6"
        style={{
          // Sticky so the tabs stay reachable when the History list is long —
          // otherwise switching tabs requires scrolling all the way back up.
          // Safe-area aware so the row sits below the notch on installed PWAs
          // and at the very top in a browser tab.
          position: "sticky",
          top: "env(safe-area-inset-top, 0px)",
          zIndex: 10,
          background: TOKENS.paper,
          borderBottom: `1px solid ${TOKENS.rule}`,
        }}
      >
        <div className="flex">
          <Tab
            label={editing ? "Editing" : "Log"}
            active={tab === "log"}
            // Leaving the tab mid-edit would silently discard changes, so this
            // exits edit mode explicitly rather than stranding the form.
            onClick={() => (editing ? finishEdit() : setTab("log"))}
          />
          <Tab
            label="History"
            active={tab === "history"}
            onClick={() => (editing ? finishEdit() : setTab("history"))}
          />
          <Tab
            label="Insights"
            active={tab === "insights"}
            onClick={() => (editing ? finishEdit() : setTab("insights"))}
          />
        </div>
        <div className="flex items-center gap-3 pb-2">
          {/* Export. The toggle stays put across clicks so the choice is
              persistent; only the Export button itself disables when there's
              nothing to dump (still loading, or zero brews). */}
          <div
            className="bl-press rounded-full overflow-hidden flex"
            style={{ border: `1px solid ${TOKENS.rule}` }}
          >
            {["json", "csv"].map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setExportFormat(fmt)}
                aria-pressed={exportFormat === fmt}
                className="px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]"
                style={{
                  fontFamily: MONO,
                  fontWeight: exportFormat === fmt ? 600 : 400,
                  background: exportFormat === fmt ? TOKENS.greenSoft : "transparent",
                  color: exportFormat === fmt ? TOKENS.green : TOKENS.inkFaint,
                }}
              >
                {fmt}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => downloadExport(pastBrews ?? [], exportFormat)}
            disabled={!pastBrews || pastBrews.length === 0}
            className="bl-press bl-quiet text-[10px] uppercase tracking-[0.1em]"
            style={{
              fontFamily: MONO,
              color: !pastBrews || pastBrews.length === 0 ? TOKENS.rule : TOKENS.inkFaint,
              cursor: !pastBrews || pastBrews.length === 0 ? "default" : "pointer",
            }}
            title={
              !pastBrews
                ? "Loading…"
                : pastBrews.length === 0
                  ? "Log a brew first"
                  : `Download all ${pastBrews.length} brews as ${exportFormat.toUpperCase()}`
            }
          >
            Export
          </button>
          {/* Both environments point at the same database and look identical,
              so the only way to tell them apart is to say so. */}
          {!IS_PRODUCTION && (
            <span
              className="px-1.5 py-0.5 rounded-sm text-[10px] uppercase tracking-[0.1em]"
              style={{
                fontFamily: MONO,
                fontWeight: 600,
                color: TOKENS.card,
                background: TOKENS.amber,
              }}
              title="Not the version your friends use"
            >
              Dev
            </span>
          )}
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="bl-press bl-quiet text-[10px] uppercase tracking-[0.1em]"
            style={{ fontFamily: MONO, color: TOKENS.inkFaint }}
          >
            Sign out
          </button>
        </div>
      </div>

      {tab === "log" ? (
        // Wait for the history fetch so the form's initial values are correct
        // on first render; it's one small query and only happens on sign-in.
        pastBrews === undefined ? null : (
          <BrewForm
            // Remounting on mode change is what re-reads the initial field
            // values, so editing a brew loads its data instead of keeping
            // whatever was on screen.
            // Remounting is what re-reads the initial field values, so the key
            // has to change for every distinct thing the form can be showing.
            key={source ? `${source.mode}-${source.brew.id}` : "new"}
            brew={editing?.brew ?? null}
            initialPhotoUrl={editing?.photoUrl ?? null}
            previousBrew={
              source?.mode === "repeat" ? source.brew : (pastBrews?.[0] ?? null)
            }
            repeating={source?.mode === "repeat"}
            suggestions={suggestionsFrom(pastBrews ?? [])}
            onSaved={() => setRefreshKey((k) => k + 1)}
            onExitEdit={finishEdit}
          />
        )
      ) : tab === "history" ? (
        <BrewHistory refreshKey={refreshKey} onEdit={startEdit} onRepeat={startRepeat} />
      ) : (
        // Reuses the fetch above rather than querying again.
        <Insights brews={pastBrews ?? []} />
      )}
    </>,
  );
}
