import React, { useState } from "react";
import { Coffee, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { TOKENS, SANS, MONO, SERIF } from "./tokens";

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

export default function Login() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || sending) return;

    setSending(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    setSending(false);
    if (signInError) setError(signInError.message);
    else setSent(true);
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError(null);

    // This navigates away to Google on success, so there's no success branch —
    // only a failure to start the flow leaves us on this page.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
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

      {sent ? (
        <p style={{ fontFamily: SERIF, fontSize: 14, color: TOKENS.ink, lineHeight: 1.6 }}>
          Check your email for the sign-in link. You can close this tab — the link
          will bring you back here.
        </p>
      ) : (
        <form onSubmit={handleLogin}>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full py-2.5 rounded-sm text-[12px] tracking-[0.08em] uppercase flex items-center justify-center gap-2.5 mb-6"
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              border: `1px solid ${TOKENS.rule}`,
              background: "transparent",
              color: TOKENS.ink,
              opacity: googleLoading ? 0.6 : 1,
              cursor: googleLoading ? "default" : "pointer",
            }}
          >
            {googleLoading ? <Loader2 size={14} className="animate-spin" /> : <GoogleMark />}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <span className="flex-1" style={{ borderTop: `1px dashed ${TOKENS.rule}` }} />
            <span
              className="text-[10px] uppercase tracking-[0.1em]"
              style={{ fontFamily: MONO, color: TOKENS.inkFaint }}
            >
              or
            </span>
            <span className="flex-1" style={{ borderTop: `1px dashed ${TOKENS.rule}` }} />
          </div>

          <p
            className="mb-6"
            style={{ fontFamily: SERIF, fontSize: 14, color: TOKENS.inkFaint, lineHeight: 1.6 }}
          >
            Or enter your email and we'll send a sign-in link. No password to remember.
          </p>

          <label className="flex flex-col gap-1.5 mb-6">
            <span
              className="text-[10px] tracking-[0.1em] uppercase"
              style={{ fontFamily: MONO, color: TOKENS.inkFaint }}
            >
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent outline-none pb-1.5 text-[14px]"
              style={{
                fontFamily: SERIF,
                color: TOKENS.ink,
                borderBottom: `1px solid ${TOKENS.rule}`,
              }}
            />
          </label>

          <button
            type="submit"
            disabled={sending}
            className="w-full py-2.5 rounded-sm text-[12px] tracking-[0.08em] uppercase flex items-center justify-center gap-2"
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              background: TOKENS.green,
              color: TOKENS.card,
              opacity: sending ? 0.6 : 1,
              cursor: sending ? "default" : "pointer",
            }}
          >
            {sending && <Loader2 size={13} className="animate-spin" />}
            {sending ? "Sending…" : "Send magic link"}
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
        </form>
      )}
    </div>
  );
}
