import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import BrewForm from "./BrewForm";
import BrewHistory from "./BrewHistory";
import { TOKENS, SANS, MONO } from "./tokens";
import { suggestionsFrom } from "./brew";
import { IS_PRODUCTION } from "./env";

// Columns the form needs for carry-forward and autocomplete. Deliberately not
// `*` — notes and photo_path aren't used here and would just add weight.
const SETUP_COLUMNS =
  "id,created_at,drink,method,machine_brand,machine_model,grinder,bean_name,bean_type,blend_components,origin,process,roast_level,roast_date,milk_brand,milk_type,grind_size,grind_unit,dose_g,water_g,water_temp_c,brew_time_s,pours";

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
  // { brew, photoUrl } while editing a saved brew, otherwise null. The photoUrl
  // is the signed URL the history card already fetched, reused as the preview
  // so the form doesn't have to sign it again.
  const [editing, setEditing] = useState(null);
  // undefined = still loading, null = no brews yet. The form waits for this so
  // its initial field values are right on first render rather than flashing
  // blank and then filling in.
  const [pastBrews, setPastBrews] = useState(undefined);

  const startEdit = (brew, photoUrl) => {
    setEditing({ brew, photoUrl: photoUrl ?? null });
    setTab("log");
  };

  const finishEdit = () => {
    setEditing(null);
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
        style={{ borderBottom: `1px solid ${TOKENS.rule}` }}
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
        </div>
        <div className="flex items-center gap-3 pb-2">
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
            key={editing?.brew.id ?? "new"}
            brew={editing?.brew ?? null}
            initialPhotoUrl={editing?.photoUrl ?? null}
            previousBrew={pastBrews?.[0] ?? null}
            suggestions={suggestionsFrom(pastBrews ?? [])}
            onSaved={() => setRefreshKey((k) => k + 1)}
            onExitEdit={finishEdit}
          />
        )
      ) : (
        <BrewHistory refreshKey={refreshKey} onEdit={startEdit} />
      )}
    </>,
  );
}
