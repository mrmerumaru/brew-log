import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import BrewForm from "./BrewForm";
import BrewHistory from "./BrewHistory";
import { TOKENS, SANS, MONO } from "./tokens";

function Tab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 text-[11px] uppercase tracking-[0.1em]"
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

  const shell = (children) => (
    <div
      style={{ background: TOKENS.paper, minHeight: "100vh" }}
      className="w-full flex flex-col items-center py-10 px-4"
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
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="text-[10px] uppercase tracking-[0.1em] pb-2"
          style={{ fontFamily: MONO, color: TOKENS.inkFaint }}
        >
          Sign out
        </button>
      </div>

      {tab === "log" ? (
        <BrewForm
          // Remounting on mode change is what re-reads the initial field
          // values, so editing a brew loads its data instead of keeping
          // whatever was on screen.
          key={editing?.brew.id ?? "new"}
          brew={editing?.brew ?? null}
          initialPhotoUrl={editing?.photoUrl ?? null}
          onSaved={() => setRefreshKey((k) => k + 1)}
          onExitEdit={finishEdit}
        />
      ) : (
        <BrewHistory refreshKey={refreshKey} onEdit={startEdit} />
      )}
    </>,
  );
}
