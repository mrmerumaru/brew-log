// Share card generation (milestone M3).
//
// The system design suggested html-to-image, but brew photos live on signed
// Supabase Storage URLs — a different origin. Inlining those in the DOM risks
// canvas tainting and blank output, and web-font loading races the render. So
// the card is painted directly onto a canvas from a Blob we fetched ourselves:
// no CORS surprises, fonts guaranteed loaded, exact output dimensions.

import { TOKENS, SANS, MONO, SERIF } from "./tokens";
import { formatBrewTime, ratioOf } from "./brew";

// 4:5 — the tallest aspect Instagram shows uncropped in feed.
const W = 1080;
const H = 1350;
const PAD = 72;

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
 * @returns {Promise<Blob>} a PNG
 */
export async function buildShareCard(brew, photoBlob) {
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
  let y = PAD;

  // ---- Photo -------------------------------------------------------------
  if (img) {
    const photoH = 820;
    ctx.save();
    roundRectPath(ctx, PAD, y, inner, photoH, 8);
    ctx.clip();
    drawCover(ctx, img, PAD, y, inner, photoH);
    ctx.restore();

    ctx.strokeStyle = TOKENS.rule;
    ctx.lineWidth = 2;
    roundRectPath(ctx, PAD, y, inner, photoH, 8);
    ctx.stroke();

    y += photoH + 64;
  } else {
    // No photo: let the type breathe instead of leaving a hole.
    y += 180;
  }

  // ---- Method + rating ---------------------------------------------------
  ctx.textBaseline = "alphabetic";

  const dots = "●".repeat(brew.rating ?? 0);
  const emptyDots = "●".repeat(5 - (brew.rating ?? 0));
  ctx.font = `600 34px ${MONO}`;
  const ratingW = ctx.measureText(dots + emptyDots).width;

  ctx.font = `700 64px ${SANS}`;
  ctx.fillStyle = TOKENS.ink;
  ctx.fillText(truncate(ctx, brew.method || "Brew", inner - ratingW - 32), PAD, y + 52);

  ctx.font = `600 34px ${MONO}`;
  const ratingX = W - PAD - ratingW;
  ctx.fillStyle = TOKENS.amber;
  ctx.fillText(dots, ratingX, y + 48);
  ctx.fillStyle = TOKENS.rule;
  ctx.fillText(emptyDots, ratingX + ctx.measureText(dots).width, y + 48);

  y += 96;

  // ---- Beans -------------------------------------------------------------
  const beans = [brew.bean_name, brew.origin].filter(Boolean).join(" · ");
  if (beans) {
    ctx.font = `400 34px ${SERIF}`;
    ctx.fillStyle = TOKENS.inkFaint;
    ctx.fillText(truncate(ctx, beans, inner), PAD, y + 26);
    y += 60;
  }

  // ---- Stats -------------------------------------------------------------
  const stats = [
    ["RATIO", ratioOf(brew)],
    ["DOSE", brew.dose_g ? `${brew.dose_g}g` : null],
    ["TEMP", brew.water_temp_c ? `${brew.water_temp_c}°C` : null],
    ["TIME", formatBrewTime(brew.brew_time_s)],
  ].filter(([, v]) => v);

  if (stats.length) {
    y += 12;
    let x = PAD;
    stats.forEach(([label, value]) => {
      ctx.font = `500 20px ${MONO}`;
      ctx.fillStyle = TOKENS.inkFaint;
      ctx.fillText(label, x, y);

      ctx.font = `600 36px ${MONO}`;
      ctx.fillStyle = TOKENS.ink;
      ctx.fillText(String(value), x, y + 42);

      x += Math.max(ctx.measureText(String(value)).width, 90) + 56;
    });
    y += 84;
  }

  // ---- Flavour tags ------------------------------------------------------
  const tags = brew.flavor_tags ?? [];
  if (tags.length) {
    y += 12;
    let x = PAD;
    const chipH = 48;
    ctx.font = `400 26px ${SERIF}`;
    tags.forEach((tag) => {
      const textW = ctx.measureText(tag).width;
      const chipW = textW + 44;
      if (x + chipW > W - PAD) return; // silently drop overflow rather than wrap off-card
      ctx.fillStyle = TOKENS.greenSoft;
      roundRectPath(ctx, x, y, chipW, chipH, chipH / 2);
      ctx.fill();
      ctx.fillStyle = TOKENS.green;
      ctx.fillText(tag, x + 22, y + 33);
      x += chipW + 12;
    });
    y += chipH + 28;
  }

  // ---- Footer ------------------------------------------------------------
  const footerY = H - PAD;
  ctx.strokeStyle = TOKENS.rule;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(PAD, footerY - 44);
  ctx.lineTo(W - PAD, footerY - 44);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `700 22px ${SANS}`;
  ctx.fillStyle = TOKENS.green;
  ctx.fillText("BREW LOG", PAD, footerY);

  if (brew.created_at) {
    const date = new Date(brew.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    ctx.font = `400 22px ${MONO}`;
    ctx.fillStyle = TOKENS.inkFaint;
    const dateW = ctx.measureText(date).width;
    ctx.fillText(date, W - PAD - dateW, footerY);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't render the card."))),
      "image/png",
    );
  });
}

export function shareCardFilename(brew) {
  const slug = (brew.method || "brew").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const date = new Date(brew.created_at ?? Date.now()).toISOString().slice(0, 10);
  return `brew-log-${slug}-${date}.png`;
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
