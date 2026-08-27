import React, { useState } from "react";
import { Coffee, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { TOKENS, SANS, MONO, SERIF } from "./tokens";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

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
          <p
            className="mb-6"
            style={{ fontFamily: SERIF, fontSize: 14, color: TOKENS.inkFaint, lineHeight: 1.6 }}
          >
            Enter your email and we'll send a sign-in link. No password to remember.
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
