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
          <Tab label="Log" active={tab === "log"} onClick={() => setTab("log")} />
          <Tab label="History" active={tab === "history"} onClick={() => setTab("history")} />
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
        <BrewForm onSaved={() => setRefreshKey((k) => k + 1)} />
      ) : (
        <BrewHistory refreshKey={refreshKey} />
      )}
    </>,
  );
}
