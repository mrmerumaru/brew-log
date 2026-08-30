import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { TOKENS, SANS, MONO, SERIF } from "./tokens";
import {
  CARD_RATIOS,
  DEFAULT_RATIO,
  buildShareCard,
  shareCardFilename,
  shareOrDownload,
} from "./shareCard";

const RATIO_KEYS = Object.keys(CARD_RATIOS);

/**
 * Preview a brew's share card, pick an aspect, then hand it to the OS share
 * sheet (or download it). Shared by the form and the history list so the two
 * entry points can't drift apart.
 */
export default function ShareSheet({ brew, photoBlob, onClose }) {
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [preview, setPreview] = useState(null); // { url, blob }
  const [building, setBuilding] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Rebuild whenever the aspect changes. Each render produces a fresh object
  // URL, so the previous one is revoked on cleanup to avoid leaking blobs.
  useEffect(() => {
    let cancelled = false;
    let url = null;

    setBuilding(true);
    setError(null);

    buildShareCard(brew, photoBlob, ratio)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, blob });
      })
      .catch((err) => {
        if (!cancelled) setError(`Couldn't build the card: ${err?.message ?? err}`);
      })
      .finally(() => {
        if (!cancelled) setBuilding(false);
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [brew, photoBlob, ratio]);

  // Escape closes, matching the expectation for any modal.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSend = async () => {
    if (!preview || sending) return;
    setSending(true);
    setError(null);
    setNotice(null);

    try {
      const result = await shareOrDownload(
        preview.blob,
        shareCardFilename(brew, ratio),
        `${brew.method ?? "Brew"}${brew.bean_name ? ` · ${brew.bean_name}` : ""}`,
      );
      if (result === "downloaded") {
        setNotice("Saved to your downloads — this browser can't share files directly.");
      } else if (result === "shared") {
        onClose();
      }
      // 'cancelled' means the user dismissed the OS sheet: stay open so they
      // can try the other aspect rather than starting over.
    } catch (err) {
      setError(`Couldn't share: ${err?.message ?? err}`);
    } finally {
      setSending(false);
    }
  };

  const { w, h } = CARD_RATIOS[ratio];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(32,29,26,0.55)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share brew"
    >
      <div
        className="w-full max-w-[380px] max-h-full overflow-y-auto rounded-sm"
        style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}` }}
        // Clicks inside must not reach the backdrop's close handler.
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${TOKENS.rule}` }}
        >
          <span
            className="text-[11px] uppercase tracking-[0.12em]"
            style={{ fontFamily: SANS, fontWeight: 700, color: TOKENS.ink }}
          >
            Share
          </span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ color: TOKENS.inkFaint }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="flex gap-2 mb-4">
            {RATIO_KEYS.map((key) => {
              const active = key === ratio;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRatio(key)}
                  className="flex-1 py-2 rounded-sm text-left px-3"
                  style={{
                    border: `1px solid ${active ? TOKENS.green : TOKENS.rule}`,
                    background: active ? TOKENS.greenSoft : "transparent",
                  }}
                >
                  <div
                    className="text-[12px]"
                    style={{
                      fontFamily: SANS,
                      fontWeight: 700,
                      color: active ? TOKENS.green : TOKENS.ink,
                    }}
                  >
                    {CARD_RATIOS[key].label}
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: active ? TOKENS.green : TOKENS.inkFaint,
                    }}
                  >
                    {key}
                  </div>
                </button>
              );
            })}
          </div>

          <p
            className="mb-4 text-[12px]"
            style={{ fontFamily: SERIF, color: TOKENS.inkFaint, lineHeight: 1.5 }}
          >
            {CARD_RATIOS[ratio].note}
          </p>

          {/* Reserve the exact aspect so switching doesn't make the dialog jump. */}
          <div
            className="w-full mb-4 flex items-center justify-center overflow-hidden rounded-sm"
            style={{
              aspectRatio: `${w} / ${h}`,
              background: TOKENS.paper,
              border: `1px solid ${TOKENS.rule}`,
            }}
          >
            {building || !preview ? (
              <Loader2 size={18} className="animate-spin" style={{ color: TOKENS.inkFaint }} />
            ) : (
              <img
                src={preview.url}
                alt="Share card preview"
                className="w-full h-full object-contain"
              />
            )}
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={building || sending || !preview}
            className="w-full py-2.5 rounded-sm text-[12px] tracking-[0.08em] uppercase flex items-center justify-center gap-2"
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              background: TOKENS.green,
              color: TOKENS.card,
              opacity: building || sending || !preview ? 0.6 : 1,
              cursor: building || sending || !preview ? "default" : "pointer",
            }}
          >
            {sending && <Loader2 size={13} className="animate-spin" />}
            {sending ? "Sharing…" : "Share this card"}
          </button>

          {error && (
            <p
              className="mt-3 text-[13px]"
              style={{ fontFamily: SERIF, color: TOKENS.red }}
              role="alert"
            >
              {error}
            </p>
          )}

          {notice && (
            <p className="mt-3 text-[13px]" style={{ fontFamily: SERIF, color: TOKENS.inkFaint }}>
              {notice}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
