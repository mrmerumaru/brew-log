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
import { formatBrewTime, ratioOf, milkLabel, originLabel } from "./brew";

// Both ratios share one layout: the photo fills the card and the text sits over
// a gradient scrim at the bottom. Adding an aspect is just another entry here.
//
// flavorTags is per-ratio because the two cards have very different room to
// spare. The Story card leaves the top ~58% of the photo clear even with two
// chip rows; on the shorter Post card they'd push the scrim over another 120px
// of a much smaller image.
export const CARD_RATIOS = {
  "9:16": {
    label: "Story",
    note: "Instagram Stories, Reels, TikTok",
    w: 1080,
    h: 1920,
    flavorTags: true,
  },
  "4:5": {
    label: "Post",
    note: "Instagram feed, X, Threads",
    w: 1080,
    h: 1350,
    flavorTags: false,
  },
};

export const DEFAULT_RATIO = "9:16";

// scale 1 = "cover" fit. offsets are normalised to -1..1 of the maximum travel
// available at the current scale, so they stay valid when the scale or the
// aspect changes and can never expose an empty edge.
export const DEFAULT_TRANSFORM = { scale: 1, offsetX: 0, offsetY: 0 };

export const MAX_ZOOM = 3;

const PAD = 72;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const CUP_SIZE = 40;
const CUP_GAP = 10;
const RATING_W = 5 * CUP_SIZE + 4 * CUP_GAP;

/**
 * A coffee cup, drawn as paths. Canvas can't use the React icon set, and an
 * emoji would render as a colour glyph that clashes with the card's palette.
 * Filled = earned rating, outline = remaining.
 */
function drawCup(ctx, x, y, size, filled, color) {
  const bodyW = size * 0.74;
  const bodyH = size * 0.66;
  const top = y + size * 0.17;

  // Tapered cup seen side-on.
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + bodyW, top);
  ctx.lineTo(x + bodyW * 0.84, top + bodyH);
  ctx.quadraticCurveTo(
    x + bodyW * 0.8,
    top + bodyH + size * 0.05,
    x + bodyW * 0.72,
    top + bodyH + size * 0.05,
  );
  ctx.lineTo(x + bodyW * 0.16, top + bodyH + size * 0.05);
  ctx.quadraticCurveTo(x + bodyW * 0.1, top + bodyH + size * 0.05, x + bodyW * 0.14, top + bodyH);
  ctx.closePath();

  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.08;
    ctx.stroke();
  }

  // Handle on the right.
  ctx.beginPath();
  ctx.arc(x + bodyW, top + bodyH * 0.36, size * 0.17, -Math.PI / 2, Math.PI / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.stroke();
}

function drawRating(ctx, x, y, rating) {
  for (let i = 0; i < 5; i += 1) {
    const filled = i < rating;
    drawCup(
      ctx,
      x + i * (CUP_SIZE + CUP_GAP),
      y,
      CUP_SIZE,
      filled,
      filled ? TOKENS.amber : TOKENS.rule,
    );
  }
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

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Measure-then-draw: work out which chips fit on which row before committing to
// a height, so the caller can reserve exactly the space needed.
function layoutChips(ctx, tags, maxWidth) {
  ctx.font = `400 ${OVER_CHIP_FONT}px ${SERIF}`;
  const rows = [];
  let row = [];
  let rowWidth = 0;

  for (const tag of tags) {
    const chipW = ctx.measureText(tag).width + 44;
    const needed = row.length ? rowWidth + OVER_CHIP_GAP + chipW : chipW;
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
  return rows.length * OVER_CHIP_H + (rows.length - 1) * OVER_CHIP_GAP;
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
/** Everything the card renders, derived once. */
function cardContent(brew) {
  return {
    // The drink is the headline. When there is one, the brewing method drops to
    // the secondary line rather than disappearing.
    headline: brew.drink || brew.method || "Brew",
    // How it was made and by whom, then the beans themselves.
    // "Espresso, Elephant Grounds" / "Blend · Brazil (50%), Aceh Gayo (50%)".
    // Method is omitted when it's already the headline (no drink recorded).
    madeLine: [brew.drink ? brew.method : null, brew.bean_name?.trim()]
      .filter(Boolean)
      .join(", "),
    beanLine: [brew.bean_type?.trim(), originLabel(brew)].filter(Boolean).join(" · "),
    milk: milkLabel(brew),
    // Grind size and days-off-roast are deliberately absent: they're personal
    // repeatability data, still recorded on the brew and shown in history, but
    // they crowded the card without meaning much to anyone else.
    stats: [
      ["RATIO", ratioOf(brew)],
      ["DOSE", brew.dose_g ? `${brew.dose_g}g` : null],
      ["TEMP", brew.water_temp_c ? `${brew.water_temp_c}°C` : null],
      ["TIME", formatBrewTime(brew.brew_time_s)],
    ].filter(([, v]) => v),
  };
}

function formattedDate(brew) {
  if (!brew.created_at) return null;
  return new Date(brew.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
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
  return drawOverlay(ctx, brew, img, CARD_RATIOS[ratio] ?? CARD_RATIOS[DEFAULT_RATIO], transform);
}

// --- Overlay layout (the Post card) ---------------------------------------
// Photo fills the card; the text sits over a gradient scrim at the bottom in
// light type. This is the only way to show a portrait photo at 4:5 — see the
// note on CARD_RATIOS.

// Light equivalents of the paper palette, for type over a photo.
const OVER_BRIGHT = TOKENS.card;
const OVER_MUTED = TOKENS.rule;

const OVER_LINE_H = 44;
const OVER_STATS_H = 40;
const OVER_GAP = 26;
const OVER_FOOTER_H = 34;
const OVER_CHIP_H = 48;
const OVER_CHIP_GAP = 12;
const OVER_CHIP_FONT = 26;
const MAX_CHIP_ROWS = 2;

function drawOverlay(ctx, brew, img, spec, transform) {
  const { w: W, h: H } = spec;

  ctx.save();
  ctx.fillStyle = TOKENS.ink;
  ctx.fillRect(0, 0, W, H);

  const inner = W - PAD * 2;
  ctx.textBaseline = "top";

  const { headline, madeLine, beanLine, milk, stats } = cardContent(brew);
  // Only where the ratio has room for them — see CARD_RATIOS.
  const chips = spec.flavorTags
    ? layoutChips(ctx, brew.flavor_tags ?? [], inner)
    : { rows: [], height: 0 };

  // ---- Photo, full card --------------------------------------------------
  let photoMetrics = null;
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    photoMetrics = drawPhoto(ctx, img, 0, 0, W, H, transform);
    ctx.restore();
  }

  // ---- Measure the text stack, bottom-anchored ---------------------------
  const blocks = [76]; // headline + rating
  if (madeLine) blocks.push(OVER_LINE_H);
  if (beanLine) blocks.push(OVER_LINE_H);
  if (milk) blocks.push(OVER_LINE_H);
  if (stats.length) blocks.push(OVER_STATS_H);
  if (chips.height) blocks.push(chips.height);

  const contentH = blocks.reduce((a, b) => a + b, 0) + OVER_GAP * (blocks.length - 1);
  const footerTop = H - PAD - OVER_FOOTER_H;
  let y = footerTop - 44 - contentH;

  // ---- Scrim -------------------------------------------------------------
  // Fades in well above the headline so the transition is invisible; the type
  // needs a near-solid base by the bottom edge to stay legible over any photo.
  const scrimTop = Math.max(0, y - 180);
  const grad = ctx.createLinearGradient(0, scrimTop, 0, H);
  grad.addColorStop(0, "rgba(32, 29, 26, 0)");
  grad.addColorStop(0.45, "rgba(32, 29, 26, 0.62)");
  grad.addColorStop(1, "rgba(32, 29, 26, 0.94)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, scrimTop, W, H - scrimTop);

  // ---- Headline + rating -------------------------------------------------
  ctx.font = `700 60px ${SANS}`;
  ctx.fillStyle = OVER_BRIGHT;
  ctx.fillText(truncate(ctx, headline.toUpperCase(), inner - RATING_W - 32), PAD, y);
  drawRating(ctx, W - PAD - RATING_W, y + 4, brew.rating ?? 0);
  y += 76 + OVER_GAP;

  // ---- Text lines --------------------------------------------------------
  for (const [text, color] of [
    [madeLine, OVER_MUTED],
    [beanLine, OVER_BRIGHT],
    [milk, OVER_MUTED],
  ]) {
    if (!text) continue;
    ctx.font = `400 30px ${SERIF}`;
    ctx.fillStyle = color;
    ctx.fillText(truncate(ctx, text, inner), PAD, y);
    y += OVER_LINE_H + OVER_GAP;
  }

  // ---- Stats, one line ---------------------------------------------------
  // A bordered table would fight the photo, so the readings run inline with
  // their labels muted and the numbers bright.
  if (stats.length) {
    let x = PAD;
    stats.forEach(([label, value], i) => {
      if (i > 0) {
        ctx.font = `400 24px ${MONO}`;
        ctx.fillStyle = OVER_MUTED;
        ctx.fillText("  ·  ", x, y + 2);
        x += ctx.measureText("  ·  ").width;
      }
      ctx.font = `500 22px ${MONO}`;
      ctx.fillStyle = OVER_MUTED;
      ctx.fillText(label, x, y + 4);
      x += ctx.measureText(label).width + 8;

      ctx.font = `600 26px ${MONO}`;
      ctx.fillStyle = OVER_BRIGHT;
      ctx.fillText(String(value), x, y);
      x += ctx.measureText(String(value)).width;
    });
    y += OVER_STATS_H + OVER_GAP;
  }

  // ---- Flavour tags ------------------------------------------------------
  // Translucent white pills rather than the app's pale-green ones: over a photo
  // a frosted fill stays legible against whatever is behind it, where a light
  // solid would flatten into a row of blank shapes.
  if (chips.height) {
    ctx.font = `400 ${OVER_CHIP_FONT}px ${SERIF}`;
    chips.rows.forEach((row, rowIndex) => {
      let x = PAD;
      const rowY = y + rowIndex * (OVER_CHIP_H + OVER_CHIP_GAP);
      row.forEach(({ tag, w }) => {
        ctx.fillStyle = "rgba(251, 250, 247, 0.18)";
        roundRectPath(ctx, x, rowY, w, OVER_CHIP_H, OVER_CHIP_H / 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(251, 250, 247, 0.34)";
        ctx.lineWidth = 2;
        roundRectPath(ctx, x, rowY, w, OVER_CHIP_H, OVER_CHIP_H / 2);
        ctx.stroke();

        ctx.fillStyle = OVER_BRIGHT;
        ctx.fillText(tag, x + 22, rowY + 11);
        x += w + OVER_CHIP_GAP;
      });
    });
  }

  // ---- Footer ------------------------------------------------------------
  const MARK_SIZE = 24;
  drawCup(ctx, PAD, footerTop - 2, MARK_SIZE, true, OVER_BRIGHT);

  ctx.font = `700 21px ${SANS}`;
  ctx.fillStyle = OVER_BRIGHT;
  ctx.fillText("BREW LOG", PAD + MARK_SIZE + 10, footerTop);

  const date = formattedDate(brew);
  if (date) {
    ctx.font = `400 21px ${MONO}`;
    ctx.fillStyle = OVER_MUTED;
    ctx.fillText(date, W - PAD - ctx.measureText(date).width, footerTop);
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
  const slug = (brew.drink || brew.method || "brew")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
