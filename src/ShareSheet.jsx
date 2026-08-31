import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { TOKENS, SANS, MONO, SERIF } from "./tokens";
import {
  CARD_RATIOS,
  DEFAULT_RATIO,
  DEFAULT_TRANSFORM,
  MAX_ZOOM,
  decodePhoto,
  drawShareCard,
  ensureFonts,
  renderCardBlob,
  shareCardFilename,
  shareOrDownload,
} from "./shareCard";

const RATIO_KEYS = Object.keys(CARD_RATIOS);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Preview a brew's share card, choose an aspect, reposition the photo, then
 * hand it to the OS share sheet (or download it). Shared by the form and the
 * history list so the two entry points can't drift apart.
 */
export default function ShareSheet({ brew, photoBlob, onClose }) {
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [transform, setTransform] = useState(DEFAULT_TRANSFORM);
  const [img, setImg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // Mirrors travelRef for rendering. A ref alone wouldn't re-render the hint
  // text when zooming first unlocks panning.
  const [canPan, setCanPan] = useState(false);

  const canvasRef = useRef(null);
  // Pan travel from the last draw, in card pixels — needed to convert pointer
  // movement into normalised offsets.
  const travelRef = useRef({ maxOffsetX: 0, maxOffsetY: 0 });
  const dragRef = useRef(null);

  const { w: cardW, h: cardH } = CARD_RATIOS[ratio];

  // Decode the photo and load fonts once, not per redraw.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([ensureFonts(), decodePhoto(photoBlob)])
      .then(([, decoded]) => {
        if (cancelled) return;
        setImg(decoded);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [photoBlob]);

  // Redraw whenever anything visible changes. Synchronous and cheap enough to
  // run at pointer-move rate.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading) return;

    canvas.width = cardW;
    canvas.height = cardH;

    try {
      const { photo } = drawShareCard(canvas.getContext("2d"), brew, img, ratio, transform);
      travelRef.current = photo ?? { maxOffsetX: 0, maxOffsetY: 0 };

      // Sub-pixel travel isn't worth advertising as draggable.
      const next = Boolean(photo) && (photo.maxOffsetX > 0.5 || photo.maxOffsetY > 0.5);
      // React bails out when the value is unchanged, so this can't loop.
      setCanPan((prev) => (prev === next ? prev : next));
    } catch (err) {
      setError(`Couldn't draw the card: ${err?.message ?? err}`);
    }
  }, [brew, img, ratio, transform, loading, cardW, cardH]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePointerDown = (e) => {
    if (!img) return;
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      // The canvas is displayed smaller than the card, so pointer pixels must
      // be scaled up into card pixels before converting to an offset.
      scale: cardW / canvas.getBoundingClientRect().width,
    };
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;

    const { maxOffsetX, maxOffsetY } = travelRef.current;
    const dx = (e.clientX - drag.x) * drag.scale;
    const dy = (e.clientY - drag.y) * drag.scale;

    setTransform((t) => ({
      ...t,
      offsetX: maxOffsetX > 0 ? clamp(drag.offsetX + dx / maxOffsetX, -1, 1) : 0,
      offsetY: maxOffsetY > 0 ? clamp(drag.offsetY + dy / maxOffsetY, -1, 1) : 0,
    }));
  };

  const endDrag = (e) => {
    if (!dragRef.current) return;
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  const handleSend = useCallback(async () => {
    if (sending || loading) return;
    setSending(true);
    setError(null);
    setNotice(null);

    try {
      const blob = await renderCardBlob(brew, img, ratio, transform);
      const result = await shareOrDownload(
        blob,
        shareCardFilename(brew, ratio),
        `${brew.drink || brew.method || "Brew"}${
          brew.bean_name ? ` · ${brew.bean_name}` : ""
        }`,
      );
      if (result === "downloaded") {
        setNotice("Saved to your downloads — this browser can't share files directly.");
      } else if (result === "shared") {
        onClose();
      }
      // 'cancelled' means the user dismissed the OS sheet: stay open so they
      // can adjust and try again rather than starting over.
    } catch (err) {
      setError(`Couldn't share: ${err?.message ?? err}`);
    } finally {
      setSending(false);
    }
  }, [brew, img, ratio, transform, sending, loading, onClose]);

  const busy = loading || sending;

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

          {/* Reserve the exact aspect so switching doesn't make the dialog jump. */}
          <div
            className="w-full mb-3 flex items-center justify-center overflow-hidden rounded-sm"
            style={{
              aspectRatio: `${cardW} / ${cardH}`,
              background: TOKENS.paper,
              border: `1px solid ${TOKENS.rule}`,
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" style={{ color: TOKENS.inkFaint }} />
            ) : (
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="w-full h-full"
                style={{
                  // touchAction none stops the browser scrolling the dialog
                  // while a drag is in progress.
                  touchAction: img ? "none" : "auto",
                  cursor: canPan ? "grab" : "default",
                }}
              />
            )}
          </div>

          {img ? (
            <>
              <div className="flex items-center gap-3 mb-1">
                <span
                  className="shrink-0"
                  style={{ fontFamily: MONO, fontSize: 9, color: TOKENS.inkFaint, letterSpacing: "0.1em" }}
                >
                  ZOOM
                </span>
                <input
                  type="range"
                  min="1"
                  max={MAX_ZOOM}
                  step="0.01"
                  value={transform.scale}
                  onChange={(e) =>
                    setTransform((t) => ({ ...t, scale: parseFloat(e.target.value) }))
                  }
                  className="flex-1"
                  style={{ accentColor: TOKENS.green }}
                  aria-label="Zoom photo"
                />
                <button
                  type="button"
                  onClick={() => setTransform(DEFAULT_TRANSFORM)}
                  className="shrink-0 text-[10px] uppercase tracking-[0.08em]"
                  style={{ fontFamily: MONO, color: TOKENS.inkFaint, textDecoration: "underline" }}
                >
                  Reset
                </button>
              </div>
              <p
                className="mb-4 text-[11px]"
                style={{ fontFamily: SERIF, color: TOKENS.inkFaint }}
              >
                {canPan
                  ? "Drag the photo to reposition it."
                  : "Zoom in to reposition the photo."}
              </p>
            </>
          ) : (
            <p
              className="mb-4 text-[12px]"
              style={{ fontFamily: SERIF, color: TOKENS.inkFaint, lineHeight: 1.5 }}
            >
              {CARD_RATIOS[ratio].note}
            </p>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={busy}
            className="w-full py-2.5 rounded-sm text-[12px] tracking-[0.08em] uppercase flex items-center justify-center gap-2"
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              background: TOKENS.green,
              color: TOKENS.card,
              opacity: busy ? 0.6 : 1,
              cursor: busy ? "default" : "pointer",
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
