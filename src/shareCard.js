// Share card generation (milestone M3).
//
// The system design suggested html-to-image, but brew photos live on signed
// Supabase Storage URLs — a different origin. Inlining those in the DOM risks
// canvas tainting and blank output, and web-font loading races the render. So
// the card is painted directly onto a canvas from a Blob we fetched ourselves:
// no CORS surprises, fonts guaranteed loaded, exact output dimensions.
//
// Drawing is split from blob generation so the share sheet can redraw a live
// preview on every pointer move while the user repositions the photo, and only
// pay for toBlob() when they actually share.

import { TOKENS, SANS, MONO, SERIF } from "./tokens";
import { formatBrewTime, ratioOf } from "./brew";

// The layout is elastic — the photo absorbs whatever space the text doesn't
// need — so a new aspect is just a new entry here.
export const CARD_RATIOS = {
  "9:16": { label: "Story", note: "Instagram Stories, Reels, TikTok", w: 1080, h: 1920 },
  "4:5": { label: "Post", note: "Instagram feed, X, Threads", w: 1080, h: 1350 },
};

export const DEFAULT_RATIO = "9:16";

// scale 1 = "cover" fit. offsets are normalised to -1..1 of the maximum travel
// available at the current scale, so they stay valid when the scale or the
// aspect changes and can never expose an empty edge.
export const DEFAULT_TRANSFORM = { scale: 1, offsetX: 0, offsetY: 0 };

export const MAX_ZOOM = 3;

const PAD = 72;

// Vertical rhythm. Block heights are measured, not guessed, so the layout can
// be assembled bottom-up and never collide with the footer.
const GAP = 36;
const CHIP_H = 54;
const CHIP_GAP = 12;
const MAX_CHIP_ROWS = 2;
// Cap so a tall card doesn't crop landscape photos to a narrow slot.
const MAX_PHOTO_RATIO = 1.25;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draw the photo to fill the frame, honouring the user's zoom and pan.
 * Returns the travel available at this scale so the caller can convert pointer
 * movement into offset changes.
 */
function drawPhoto(ctx, img, x, y, w, h, transform) {
  const cover = Math.max(w / img.width, h / img.height);
  const scale = cover * Math.max(1, transform.scale);
  const dw = img.width * scale;
  const dh = img.height * scale;

  // How far the image can slide before an edge would enter the frame.
  const maxOffsetX = Math.max(0, (dw - w) / 2);
  const maxOffsetY = Math.max(0, (dh - h) / 2);

  const ox = clamp(transform.offsetX, -1, 1) * maxOffsetX;
  const oy = clamp(transform.offsetY, -1, 1) * maxOffsetY;

  ctx.drawImage(img, x + (w - dw) / 2 + ox, y + (h - dh) / 2 + oy, dw, dh);

  return { maxOffsetX, maxOffsetY };
}

// Measure-then-draw: work out which chips fit on which row before committing to
// a height, so the caller can reserve exactly the space needed.
function layoutChips(ctx, tags, maxWidth) {
  ctx.font = `400 28px ${SERIF}`;
  const rows = [];
  let row = [];
  let rowWidth = 0;

  for (const tag of tags) {
    const chipW = ctx.measureText(tag).width + 46;
    const needed = row.length ? rowWidth + CHIP_GAP + chipW : chipW;
    if (needed > maxWidth && row.length) {
      rows.push(row);
      if (rows.length === MAX_CHIP_ROWS) return { rows, height: chipRowsHeight(rows) };
      row = [{ tag, w: chipW }];
      rowWidth = chipW;
    } else {
      row.push({ tag, w: chipW });
      rowWidth = needed;
    }
  }
  if (row.length) rows.push(row);
  return { rows, height: chipRowsHeight(rows) };
}

function chipRowsHeight(rows) {
  if (!rows.length) return 0;
  return rows.length * CHIP_H + (rows.length - 1) * CHIP_GAP;
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "…";
}

/** Canvas won't wait for web fonts; without this the card renders in a fallback face. */
export async function ensureFonts() {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // proceed with whatever is available
    }
  }
}

/** Turn a photo Blob into something drawable. Resolves null if it can't be read. */
export async function decodePhoto(blob) {
  if (!blob) return null;
  try {
    if (typeof createImageBitmap === "function") return await createImageBitmap(blob);
  } catch {
    // fall through to the <img> path below
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null); // a missing photo shouldn't block the card
    };
    img.src = url;
  });
}

/**
 * Paint one brew's card onto an existing context. Synchronous, so it's safe to
 * call at pointer-move rate.
 *
 * @returns {{ photo: null | { maxOffsetX: number, maxOffsetY: number } }}
 *   travel available for panning, in card pixels
 */
export function drawShareCard(ctx, brew, img, ratio = DEFAULT_RATIO, transform = DEFAULT_TRANSFORM) {
  const { w: W, h: H } = CARD_RATIOS[ratio] ?? CARD_RATIOS[DEFAULT_RATIO];

  ctx.save();
  ctx.fillStyle = TOKENS.paper;
  ctx.fillRect(0, 0, W, H);

  const inner = W - PAD * 2;
  ctx.textBaseline = "top";

  // ---- Measure everything before drawing anything -------------------------
  // The footer owns the bottom of the card; text blocks stack upward from it;
  // the photo takes whatever is left. Nothing can overlap because no block is
  // positioned until every height is known.

  const beans = [brew.bean_name, brew.origin].filter(Boolean).join(" · ");

  const stats = [
    ["RATIO", ratioOf(brew)],
    ["DOSE", brew.dose_g ? `${brew.dose_g}g` : null],
    ["TEMP", brew.water_temp_c ? `${brew.water_temp_c}°C` : null],
    ["TIME", formatBrewTime(brew.brew_time_s)],
  ].filter(([, v]) => v);

  const chips = layoutChips(ctx, brew.flavor_tags ?? [], inner);

  const METHOD_H = 76;
  const BEANS_H = 46;
  const STATS_H = 80;

  const blocks = [METHOD_H];
  if (beans) blocks.push(BEANS_H);
  if (stats.length) blocks.push(STATS_H);
  if (chips.height) blocks.push(chips.height);

  const contentH = blocks.reduce((a, b) => a + b, 0) + GAP * (blocks.length - 1);

  const footerLineY = H - PAD - 56;
  const contentBottom = footerLineY - 56;
  let y = contentBottom - contentH;

  // ---- Photo -------------------------------------------------------------
  let photoMetrics = null;
  if (img) {
    const available = y - PAD - 56;
    const photoH = Math.min(available, inner * MAX_PHOTO_RATIO);
    const photoY = PAD + Math.max(0, (available - photoH) / 2);

    ctx.save();
    roundRectPath(ctx, PAD, photoY, inner, photoH, 8);
    ctx.clip();
    photoMetrics = drawPhoto(ctx, img, PAD, photoY, inner, photoH, transform);
    ctx.restore();

    ctx.strokeStyle = TOKENS.rule;
    ctx.lineWidth = 2;
    roundRectPath(ctx, PAD, photoY, inner, photoH, 8);
    ctx.stroke();
  } else {
    // Nothing to fill the space, so centre the text between top and footer
    // rather than stranding it at the bottom.
    y = PAD + (footerLineY - PAD - contentH) / 2;
  }

  // ---- Method + rating ---------------------------------------------------
  const filled = "●".repeat(brew.rating ?? 0);
  const empty = "●".repeat(5 - (brew.rating ?? 0));
  ctx.font = `600 36px ${MONO}`;
  const filledW = ctx.measureText(filled).width;
  const ratingW = ctx.measureText(filled + empty).width;

  ctx.font = `700 64px ${SANS}`;
  ctx.fillStyle = TOKENS.ink;
  ctx.fillText(truncate(ctx, brew.method || "Brew", inner - ratingW - 32), PAD, y);

  ctx.font = `600 36px ${MONO}`;
  const ratingX = W - PAD - ratingW;
  const ratingY = y + 18; // optical centring against the 64px method
  ctx.fillStyle = TOKENS.amber;
  ctx.fillText(filled, ratingX, ratingY);
  ctx.fillStyle = TOKENS.rule;
  ctx.fillText(empty, ratingX + filledW, ratingY);

  y += METHOD_H + GAP;

  // ---- Beans -------------------------------------------------------------
  if (beans) {
    ctx.font = `400 34px ${SERIF}`;
    ctx.fillStyle = TOKENS.inkFaint;
    ctx.fillText(truncate(ctx, beans, inner), PAD, y);
    y += BEANS_H + GAP;
  }

  // ---- Stats -------------------------------------------------------------
  if (stats.length) {
    // Even columns across the full width, so four stats don't bunch left.
    const colW = inner / stats.length;
    stats.forEach(([label, value], i) => {
      const x = PAD + colW * i;
      ctx.font = `500 20px ${MONO}`;
      ctx.fillStyle = TOKENS.inkFaint;
      ctx.fillText(label, x, y);

      ctx.font = `600 36px ${MONO}`;
      ctx.fillStyle = TOKENS.ink;
      ctx.fillText(truncate(ctx, String(value), colW - 16), x, y + 32);
    });
    y += STATS_H + GAP;
  }

  // ---- Flavour tags ------------------------------------------------------
  if (chips.height) {
    ctx.font = `400 28px ${SERIF}`;
    chips.rows.forEach((row, rowIndex) => {
      let x = PAD;
      const rowY = y + rowIndex * (CHIP_H + CHIP_GAP);
      row.forEach(({ tag, w }) => {
        ctx.fillStyle = TOKENS.greenSoft;
        roundRectPath(ctx, x, rowY, w, CHIP_H, CHIP_H / 2);
        ctx.fill();
        ctx.fillStyle = TOKENS.green;
        ctx.fillText(tag, x + 23, rowY + 13);
        x += w + CHIP_GAP;
      });
    });
  }

  // ---- Footer ------------------------------------------------------------
  ctx.strokeStyle = TOKENS.rule;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(PAD, footerLineY);
  ctx.lineTo(W - PAD, footerLineY);
  ctx.stroke();
  ctx.setLineDash([]);

  const footerTextY = footerLineY + 26;
  ctx.font = `700 22px ${SANS}`;
  ctx.fillStyle = TOKENS.green;
  ctx.fillText("BREW LOG", PAD, footerTextY);

  if (brew.created_at) {
    const date = new Date(brew.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    ctx.font = `400 22px ${MONO}`;
    ctx.fillStyle = TOKENS.inkFaint;
    ctx.fillText(date, W - PAD - ctx.measureText(date).width, footerTextY);
  }

  ctx.restore();
  return { photo: photoMetrics };
}

/** Render a card to a PNG Blob, at full output resolution. */
export async function renderCardBlob(brew, img, ratio = DEFAULT_RATIO, transform = DEFAULT_TRANSFORM) {
  await ensureFonts();

  const { w, h } = CARD_RATIOS[ratio] ?? CARD_RATIOS[DEFAULT_RATIO];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  drawShareCard(canvas.getContext("2d"), brew, img, ratio, transform);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't render the card."))),
      "image/png",
    );
  });
}

export function shareCardFilename(brew, ratio = DEFAULT_RATIO) {
  const slug = (brew.method || "brew").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const date = new Date(brew.created_at ?? Date.now()).toISOString().slice(0, 10);
  const size = ratio.replace(":", "x");
  return `brew-log-${slug}-${date}-${size}.png`;
}

/**
 * Hand the card to the OS share sheet where that exists (phones), otherwise
 * fall back to a download. Must be called from a user gesture.
 * @returns {Promise<'shared'|'cancelled'|'downloaded'>}
 */
export async function shareOrDownload(blob, filename, text) {
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (err) {
      // The user dismissing the sheet is a normal outcome, not a failure.
      if (err?.name === "AbortError") return "cancelled";
      // Anything else: fall through to the download path.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
