// Share card generation (milestone M3).
//
// The system design suggested html-to-image, but brew photos live on signed
// Supabase Storage URLs — a different origin. Inlining those in the DOM risks
// canvas tainting and blank output, and web-font loading races the render. So
// the card is painted directly onto a canvas from a Blob we fetched ourselves:
// no CORS surprises, fonts guaranteed loaded, exact output dimensions.

import { TOKENS, SANS, MONO, SERIF } from "./tokens";
import { formatBrewTime, ratioOf } from "./brew";

// The layout is elastic — the photo absorbs whatever space the text doesn't
// need — so a new aspect is just a new entry here.
export const CARD_RATIOS = {
  "9:16": { label: "Story", note: "Instagram Stories, Reels, TikTok", w: 1080, h: 1920 },
  "4:5": { label: "Post", note: "Instagram feed, X, Threads", w: 1080, h: 1350 },
};

export const DEFAULT_RATIO = "9:16";

const PAD = 72;

// Vertical rhythm. Block heights are measured, not guessed, so the layout can
// be assembled bottom-up and never collide with the footer.
const GAP = 36;
const CHIP_H = 54;
const CHIP_GAP = 12;
const MAX_CHIP_ROWS = 2;
// Cap so a tall card doesn't crop landscape photos to a narrow slot.
const MAX_PHOTO_RATIO = 1.25;

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// object-fit: cover — fill the box, cropping the overflow, never distorting.
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
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

async function decode(blob) {
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
 * Paint a share card for one brew.
 * @param {object} brew  a row from the `brews` table
 * @param {Blob|null} photoBlob  the brew photo, already downloaded
 * @param {keyof CARD_RATIOS} ratio  output aspect
 * @returns {Promise<Blob>} a PNG
 */
export async function buildShareCard(brew, photoBlob, ratio = DEFAULT_RATIO) {
  const { w: W, h: H } = CARD_RATIOS[ratio] ?? CARD_RATIOS[DEFAULT_RATIO];
  // Without this the card renders in a fallback face — the web fonts may not
  // have loaded yet, and canvas won't wait for them.
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // proceed with whatever is available
    }
  }

  const img = await decode(photoBlob);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

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
  if (img) {
    const available = y - PAD - 56;
    const photoH = Math.min(available, inner * MAX_PHOTO_RATIO);
    const photoY = PAD + Math.max(0, (available - photoH) / 2);

    ctx.save();
    roundRectPath(ctx, PAD, photoY, inner, photoH, 8);
    ctx.clip();
    drawCover(ctx, img, PAD, photoY, inner, photoH);
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
