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

// The layout is elastic — the photo absorbs whatever space the text doesn't
// need — so a new aspect is just a new entry here.
export const CARD_RATIOS = {
  // Two layouts, because the geometry forces it. A portrait photo has to be
  // taller than the 1080px card width, which the 1920px-tall Story card can
  // accommodate above the text but the 1350px-tall Post card cannot — even
  // carrying nothing but the drink name, its tallest fitting photo is 1029px,
  // still landscape. So the Post card puts the text over the photo instead.
  "9:16": {
    label: "Story",
    note: "Instagram Stories, Reels, TikTok",
    w: 1080,
    h: 1920,
    layout: "specimen",
  },
  "4:5": {
    label: "Post",
    note: "Instagram feed, X, Threads",
    w: 1080,
    h: 1350,
    layout: "overlay",
  },
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

// The photo bleeds to the card edges and hands off to the paper panel across an
// amber hairline. No cap on its height: it starts at the very top edge and runs
// to wherever the content begins, so there's never leftover space to centre it
// in — which is what used to leave a void above it.
const RULE_H = 5;
// The step from the amber rule to the headline separates two zones — image and
// text — so it stays the largest vertical interval on the card, comfortably
// bigger than the gaps between content blocks even when everything compresses.
const AFTER_RULE = 88;

// Photo height as a fraction of the card WIDTH, so values above 1 are portrait:
// 1.25 is a 4:5 portrait frame, 1 is square, 2/3 is 3:2 landscape.
//
// The photo gets what it asks for until the content can't fit beneath it. Then
// spacing compresses — gaps down to MIN_GAP, the rule-to-content step down to
// MIN_AFTER_RULE — and only once that's exhausted does the photo give way. So a
// tall photo squeezes the information rather than colliding with it.
const PHOTO_ASPECT = 1.25;
const MIN_GAP = 16;
const MIN_AFTER_RULE = 56;

// Stats sit in a banded table: a dashed rule across the top, then columns
// separated by hairlines.
const STATS_BAND_H = 104;
const STATS_TOP_PAD = 26;

// One typeface and size for the method/roastery, beans and milk lines, so they
// read as a single block rather than three unrelated treatments.
const LINE_FONT = 32;

// The stat label is the larger, bolder half; the reading sits under it a little
// smaller and quieter.
const STAT_LABEL_FONT = 30;
const STAT_VALUE_FONT = 26;

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
/** Everything both layouts render, derived once. */
function cardContent(ctx, brew, inner) {
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
    chips: layoutChips(ctx, brew.flavor_tags ?? [], inner),
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
  const spec = CARD_RATIOS[ratio] ?? CARD_RATIOS[DEFAULT_RATIO];
  return spec.layout === "overlay"
    ? drawOverlay(ctx, brew, img, spec, transform)
    : drawSpecimen(ctx, brew, img, spec, transform);
}

function drawSpecimen(ctx, brew, img, spec, transform) {
  const { w: W, h: H } = spec;

  ctx.save();
  ctx.fillStyle = TOKENS.paper;
  ctx.fillRect(0, 0, W, H);

  const inner = W - PAD * 2;
  ctx.textBaseline = "top";

  // ---- Measure everything before drawing anything -------------------------
  // The footer owns the bottom of the card; text blocks stack upward from it;
  // the photo takes whatever is left. Nothing can overlap because no block is
  // positioned until every height is known.

  const { headline, madeLine, beanLine, milk, stats, chips } = cardContent(ctx, brew, inner);

  const METHOD_H = 76;
  const LINE_H = 46;

  const blocks = [METHOD_H];
  if (madeLine) blocks.push(LINE_H);
  if (beanLine) blocks.push(LINE_H);
  if (milk) blocks.push(LINE_H);
  if (stats.length) blocks.push(STATS_BAND_H);
  if (chips.height) blocks.push(chips.height);

  const sumBlocks = blocks.reduce((a, b) => a + b, 0);
  const gapCount = Math.max(0, blocks.length - 1);

  const footerLineY = H - PAD - 56;
  const contentBottom = footerLineY - 56;

  // Resolved below: both depend on how much room the photo leaves.
  let gap = GAP;
  let contentH = sumBlocks + gap * gapCount;
  let y = contentBottom - contentH;

  // ---- Photo -------------------------------------------------------------
  let photoMetrics = null;
  if (img) {
    // The tallest photo that still leaves room for the content at its most
    // compressed. This is the floor that keeps text off the footer.
    const floorContentH = sumBlocks + MIN_GAP * gapCount;
    const maxPhotoH = Math.max(0, contentBottom - floorContentH - MIN_AFTER_RULE - RULE_H);
    const photoH = Math.min(W * PHOTO_ASPECT, maxPhotoH);

    // Hand the leftover paper out in priority order: the step below the rule
    // first, then the gaps between blocks, then centre whatever still remains.
    const spare = contentBottom - photoH - RULE_H - floorContentH;
    const afterRule = Math.min(AFTER_RULE, spare);
    const gapSlack = spare - afterRule;
    gap = gapCount ? Math.min(GAP, MIN_GAP + gapSlack / gapCount) : GAP;
    contentH = sumBlocks + gap * gapCount;

    const regionTop = photoH + RULE_H + afterRule;
    y = regionTop + Math.max(0, (contentBottom - regionTop - contentH) / 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, photoH);
    ctx.clip();
    photoMetrics = drawPhoto(ctx, img, 0, 0, W, photoH, transform);
    ctx.restore();

    // The accent that hands off from photo to paper.
    ctx.fillStyle = TOKENS.amber;
    ctx.fillRect(0, photoH, W, RULE_H);
  } else {
    // Nothing to fill the space, so centre the text between top and footer
    // rather than stranding it at the bottom.
    y = PAD + (footerLineY - PAD - contentH) / 2;
  }

  // ---- Method + rating ---------------------------------------------------
  // Uppercase gives the headline poster weight against the serif lines below.
  ctx.font = `700 64px ${SANS}`;
  ctx.fillStyle = TOKENS.ink;
  ctx.fillText(truncate(ctx, headline.toUpperCase(), inner - RATING_W - 32), PAD, y);

  // Optically centred against the 64px headline.
  drawRating(ctx, W - PAD - RATING_W, y + 6, brew.rating ?? 0);

  y += METHOD_H + gap;

  // ---- Beans -------------------------------------------------------------
  if (madeLine) {
    ctx.font = `400 ${LINE_FONT}px ${SERIF}`;
    ctx.fillStyle = TOKENS.inkFaint;
    ctx.fillText(truncate(ctx, madeLine, inner), PAD, y);
    y += LINE_H + gap;
  }

  // ---- Beans -------------------------------------------------------------
  if (beanLine) {
    ctx.font = `400 ${LINE_FONT}px ${SERIF}`;
    ctx.fillStyle = TOKENS.ink;
    ctx.fillText(truncate(ctx, beanLine, inner), PAD, y);
    y += LINE_H + gap;
  }

  // ---- Milk --------------------------------------------------------------
  if (milk) {
    ctx.font = `400 ${LINE_FONT}px ${SERIF}`;
    ctx.fillStyle = TOKENS.inkFaint;
    ctx.fillText(truncate(ctx, milk, inner), PAD, y);
    y += LINE_H + gap;
  }

  // ---- Stats -------------------------------------------------------------
  if (stats.length) {
    // Dashed rule opens the band, echoing the dividers in the app's form.
    ctx.strokeStyle = TOKENS.rule;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const bandTop = y + STATS_TOP_PAD;
    // Even columns across the full width, so four stats don't bunch left.
    const colW = inner / stats.length;

    stats.forEach(([label, value], i) => {
      const colX = PAD + colW * i;
      // Column 0's left edge is the page margin, so only the inner boundaries
      // get a hairline — and only those columns need the matching text inset.
      const textX = colX + (i === 0 ? 0 : 20);

      if (i > 0) {
        ctx.strokeStyle = TOKENS.rule;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(colX, bandTop - 8);
        ctx.lineTo(colX, bandTop + 72);
        ctx.stroke();
      }

      // The label leads and the reading follows it, quieter and smaller.
      ctx.font = `700 ${STAT_LABEL_FONT}px ${MONO}`;
      ctx.fillStyle = TOKENS.ink;
      // Labels get truncated too, so a longer one added later can't silently
      // overlap its neighbour.
      ctx.fillText(truncate(ctx, label, colW - 36), textX, bandTop);

      ctx.font = `500 ${STAT_VALUE_FONT}px ${MONO}`;
      ctx.fillStyle = TOKENS.inkFaint;
      ctx.fillText(truncate(ctx, String(value), colW - 36), textX, bandTop + 40);
    });

    y += STATS_BAND_H + gap;
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

  // Cup mark ahead of the wordmark, same green.
  const MARK_SIZE = 26;
  drawCup(ctx, PAD, footerTextY - 3, MARK_SIZE, true, TOKENS.green);

  ctx.font = `700 22px ${SANS}`;
  ctx.fillStyle = TOKENS.green;
  ctx.fillText("BREW LOG", PAD + MARK_SIZE + 10, footerTextY);

  const date = formattedDate(brew);
  if (date) {
    ctx.font = `400 22px ${MONO}`;
    ctx.fillStyle = TOKENS.inkFaint;
    ctx.fillText(date, W - PAD - ctx.measureText(date).width, footerTextY);
  }

  ctx.restore();
  return { photo: photoMetrics };
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

function drawOverlay(ctx, brew, img, spec, transform) {
  const { w: W, h: H } = spec;

  ctx.save();
  ctx.fillStyle = TOKENS.ink;
  ctx.fillRect(0, 0, W, H);

  const inner = W - PAD * 2;
  ctx.textBaseline = "top";

  const { headline, madeLine, beanLine, milk, stats } = cardContent(ctx, brew, inner);
  // Flavour chips are dropped here: pills over a photo read as clutter, and the
  // scrim would have to grow to cover two more rows.

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
