// Client-side photo resizing, done before upload.
//
// Phone photos are 3-5 MB each. Supabase's free tier gives 1 GB of storage, so
// uploading originals caps the whole project at roughly 250 photos across all
// users. Resizing to MAX_EDGE at JPEG_QUALITY lands around 400 KB, which is
// closer to 2,500 — and the system design flagged this as an open question
// precisely because it gets worse with use rather than staying still.
//
// MAX_EDGE is chosen against the share card, which is the largest place a photo
// is ever drawn: the card is 1080px wide and its photo frame about 1250px tall,
// so a 2000px longest edge still covers it without upscaling at 1x zoom. In the
// app itself photos never exceed a 72px thumbnail.

export const MAX_EDGE = 2000;
export const JPEG_QUALITY = 0.82;

// Thumbnail dimensions. History renders photos at 56-72px; 256-px source
// covers those sizes at 2x retina without upscaling, and lands each file at
// roughly 30-80 KB — about 10x smaller than MAX_EDGE — so a single page load
// in History stops pulling tens of MB of photo bytes through the signed URL.
export const THUMB_MAX_EDGE = 256;
export const THUMB_QUALITY = 0.82;

/** Scaled dimensions that fit inside maxEdge, never enlarging. Pure, for tests. */
export function targetSize(width, height, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height);
  if (!longest) return { width: 0, height: 0, scale: 1 };
  const scale = Math.min(1, maxEdge / longest);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/**
 * Decode a photo, honouring its EXIF orientation.
 *
 * This matters more than it looks. Phones record portrait shots as landscape
 * pixels plus an EXIF rotation flag, and re-encoding through a canvas drops
 * that flag — so without `imageOrientation: "from-image"` every portrait photo
 * would be stored sideways. `createImageBitmap` ignores EXIF by default, which
 * is why the plain call is NOT used as the fallback: an <img> element applies
 * the orientation itself, so that path stays correct on browsers too old for
 * the option.
 */
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Option unsupported, or the format can't be decoded — fall through.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not decode the image"));
    };
    img.src = url;
  });
}

/**
 * Encode an already-decoded source image to a JPEG blob at a target edge and
 * quality. Pure-ish: depends on a canvas, but not on a File. Shared between
 * compressPhoto (full-size, 2000px) and compressThumbnail (256px).
 *
 * @returns {Promise<Blob | null>} null if the browser fails to encode.
 */
async function encodeJpeg(source, width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // JPEG has no alpha channel, so a transparent source (a PNG screenshot,
  // say) would otherwise composite onto black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Resize and re-encode a photo for upload.
 *
 * Always resolves with something uploadable: if anything goes wrong — an
 * undecodable format such as HEIC on a browser that can't read it, a failed
 * encode, or a result no smaller than the input — it returns the original file
 * untouched. Losing the photo would be far worse than storing a large one.
 *
 * @returns {Promise<{blob: Blob, ext: string, contentType: string, note: string}>}
 */
export async function compressPhoto(file, fallbackExt = "jpg") {
  const original = {
    blob: file,
    ext: fallbackExt,
    contentType: file?.type || undefined,
  };
  if (!file) return null;

  let source;
  try {
    source = await decode(file);
  } catch {
    return { ...original, note: "kept original: could not decode" };
  }

  try {
    const { width, height, scale } = targetSize(source.width, source.height);

    const blob = await encodeJpeg(source, width, height, JPEG_QUALITY);

    if (!blob) return { ...original, note: "kept original: encode failed" };

    // An already-optimised small JPEG can come out bigger after a round trip.
    if (blob.size >= file.size) {
      return { ...original, note: "kept original: it was already smaller" };
    }

    const pct = Math.round((1 - blob.size / file.size) * 100);
    return {
      blob,
      ext: "jpg",
      contentType: "image/jpeg",
      note:
        `${scale < 1 ? `resized to ${width}x${height}` : "re-encoded"}, ` +
        `${kb(file.size)} to ${kb(blob.size)} (${pct}% smaller)`,
    };
  } finally {
    // ImageBitmap holds decoded pixels until released; <img> has no close().
    source.close?.();
  }
}

/**
 * Produce a small JPEG for the History list. Smaller than compressPhoto in
 * every dimension (256px max edge vs 2000px, same quality 0.82) so a signed
 * URL pointing here serves roughly 10x fewer bytes per photo.
 *
 * Same failure semantics as compressPhoto: returns the original file on any
 * decode/encode error so a thumb failure can never block a brew from saving.
 *
 * @returns {Promise<{blob: Blob, ext: string, contentType: string, note: string}>}
 */
export async function compressThumbnail(file, fallbackExt = "jpg") {
  const original = {
    blob: file,
    ext: fallbackExt,
    contentType: file?.type || undefined,
  };
  if (!file) return null;

  let source;
  try {
    source = await decode(file);
  } catch {
    return { ...original, note: "kept original: could not decode" };
  }

  try {
    const { width, height, scale } = targetSize(
      source.width,
      source.height,
      THUMB_MAX_EDGE,
    );

    const blob = await encodeJpeg(source, width, height, THUMB_QUALITY);

    if (!blob) return { ...original, note: "kept original: encode failed" };

    const pct = Math.round((1 - blob.size / file.size) * 100);
    return {
      blob,
      ext: "jpg",
      contentType: "image/jpeg",
      note:
        `${scale < 1 ? `resized to ${width}x${height}` : "re-encoded"}, ` +
        `${kb(file.size)} to ${kb(blob.size)} (${pct}% smaller)`,
    };
  } finally {
    source.close?.();
  }
}

function kb(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}
