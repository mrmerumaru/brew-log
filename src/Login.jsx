import React, { useState } from "react";
import { Coffee, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { TOKENS, SANS, SERIF } from "./tokens";

// Google's brand mark. Inline rather than a remote asset so it works offline
// and can't be blocked.
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// Google is the only way in. Magic-link sign-in was removed once it stopped
// being used: Supabase's built-in email sender is rate-limited to a couple of
// messages an hour, which made it unreliable for anyone but the first user.
// Email OTP is still enabled on the Supabase project, so restoring a fallback
// is a UI change only — no configuration to redo.
export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogle = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    // This navigates away to Google on success, so there's no success branch —
    // only a failure to start the flow leaves us on this page.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-[380px] rounded-sm px-6 py-8"
      style={{
        background: TOKENS.card,
        border: `1px solid ${TOKENS.rule}`,
        boxShadow: "0 1px 2px rgba(32,29,26,0.04)",
      }}
    >
      <div className="flex items-center gap-2 mb-6">
        <Coffee size={16} style={{ color: TOKENS.green }} strokeWidth={2} />
        <span
          className="text-[15px]"
          style={{ fontFamily: SANS, fontWeight: 700, color: TOKENS.ink, letterSpacing: "0.01em" }}
        >
          Brew Log
        </span>
      </div>

      <p
        className="mb-6"
        style={{ fontFamily: SERIF, fontSize: 14, color: TOKENS.inkFaint, lineHeight: 1.6 }}
      >
        Sign in to log your brews and look back at what worked. Your brews are
        private to you.
      </p>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full py-2.5 rounded-sm text-[12px] tracking-[0.08em] uppercase flex items-center justify-center gap-2.5"
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          border: `1px solid ${TOKENS.rule}`,
          background: "transparent",
          color: TOKENS.ink,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <GoogleMark />}
        Continue with Google
      </button>

      {error && (
        <p
          className="mt-4 text-[13px]"
          style={{ fontFamily: SERIF, color: TOKENS.red }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
