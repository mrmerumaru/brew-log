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
//
// What gets stored is always a JPEG this module encoded itself. That is a
// security property, not a style choice: the alternative — passing the user's
// bytes through when re-encoding fails — would upload an attacker-chosen file
// type, under an attacker-chosen extension, with the original EXIF block
// (including GPS) intact. Anything we cannot decode is now refused with a
// visible message instead of being stored quietly.

export const MAX_EDGE = 2000;
export const JPEG_QUALITY = 0.82;

// Thumbnail dimensions. History renders photos at 56-72px; 256-px source
// covers those sizes at 2x retina without upscaling, and lands each file at
// roughly 30-80 KB — about 10x smaller than MAX_EDGE — so a single page load
// in History stops pulling tens of MB of photo bytes through the signed URL.
export const THUMB_MAX_EDGE = 256;
export const THUMB_QUALITY = 0.82;

/** Extension and content type of every stored photo. */
export const STORED_EXT = "jpg";
export const STORED_CONTENT_TYPE = "image/jpeg";

/**
 * Input formats we are willing to decode. This is an allowlist, not a filter:
 * an extension is only accepted if it appears here, and the bytes still have to
 * look like an image before anything is uploaded.
 */
const ACCEPTED_INPUT_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "heif",
]);

/**
 * Raised when a file cannot become one of our own JPEGs. `code` lets the form
 * explain why instead of showing a raw exception.
 *
 *   not_an_image  the bytes are not an image we recognise (renamed file, SVG,
 *                 HTML, corrupt download)
 *   undecodable   a real image, but this browser cannot decode it (HEIC on
 *                 Chrome/Android is the common case)
 *   encode_failed the browser decoded it but could not re-encode it
 */
export class PhotoRejectedError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PhotoRejectedError";
    this.code = code;
  }
}

/** Lowercase extension from a filename, or "" when there isn't one. */
export function inputExtension(name = "") {
  const m = /\.([a-z0-9]+)$/i.exec(String(name));
  return m ? m[1].toLowerCase() : "";
}

/**
 * Cheap declared-type check, used at pick time so an obvious non-image never
 * reaches the preview or the encoder. The bytes are verified separately in
 * classifyPhoto — a name and a MIME type are both attacker-controlled.
 */
export function isLikelyImage(file) {
  if (!file) return false;
  if (inputExtension(file.name) && ACCEPTED_INPUT_EXT.has(inputExtension(file.name))) {
    return true;
  }
  return typeof file.type === "string" && file.type.startsWith("image/");
}

/**
 * Identify an image from its leading bytes. Returns the MIME type, or null.
 *
 * Only the formats in ACCEPTED_INPUT_EXT can match, which is the point: a file
 * renamed to .jpg still has to carry a real image header to get this far.
 *
 * @param {Uint8Array|null} bytes first ~32 bytes of the file
 */
export function sniffImageType(bytes) {
  if (!bytes || bytes.length < 4) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";

  // GIF: "GIF87a" / "GIF89a"
  if (bytes.length >= 6) {
    const gif = String.fromCharCode(...bytes.slice(0, 6));
    if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  }

  // WebP: "RIFF" .... "WEBP"
  if (bytes.length >= 12) {
    const riff = String.fromCharCode(...bytes.slice(0, 4));
    const form = String.fromCharCode(...bytes.slice(8, 12));
    if (riff === "RIFF" && form === "WEBP") return "image/webp";
  }

  // HEIF family: box size, "ftyp", then the brand.
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }

  return null;
}

/**
 * Decide whether a file may be uploaded at all, from its declared name/type and
 * its leading bytes. Pure, so the rule is testable without a DOM.
 *
 * The bytes win when they are readable: a recognised header is accepted, and
 * anything else is refused even if the name says .jpg — that is what stops a
 * renamed HTML/SVG payload from reaching the bucket.
 *
 * @returns {{ok: boolean, type: string|null, reason: string|null}}
 */
export function classifyPhoto({ name = "", type = "", head = null } = {}) {
  const sniffed = sniffImageType(head);
  if (sniffed) return { ok: true, type: sniffed, reason: null };

  // Enough bytes to judge, and none of them look like an image.
  if (head && head.length >= 12) return { ok: false, type: null, reason: "not_an_image" };

  // Nothing readable (unusual) — fall back to the declaration, and let the
  // decoder be the judge.
  if (isLikelyImage({ name, type })) return { ok: true, type: null, reason: null };
  return { ok: false, type: null, reason: "not_an_image" };
}

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

/** First bytes of a File, or null when they cannot be read. */
async function readHead(file, n = 32) {
  try {
    const buf = await file.slice(0, n).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
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
 * Decode, resize and re-encode one photo at `maxEdge`/`quality`.
 *
 * Shared body of compressPhoto and compressThumbnail. Throws
 * PhotoRejectedError when the input cannot become our own JPEG — there is no
 * pass-through path, by design (see the note at the top of this file).
 */
async function reencode(file, maxEdge, quality) {
  if (!file) return null;

  const verdict = classifyPhoto({
    name: file.name,
    type: file.type,
    head: await readHead(file),
  });
  if (!verdict.ok) {
    throw new PhotoRejectedError(
      verdict.reason ?? "not_an_image",
      "the file is not a photo we can store",
    );
  }

  let source;
  try {
    source = await decode(file);
  } catch {
    throw new PhotoRejectedError(
      "undecodable",
      "this browser cannot decode the photo's format",
    );
  }

  try {
    const { width, height, scale } = targetSize(source.width, source.height, maxEdge);

    const blob = await encodeJpeg(source, width, height, quality);
    if (!blob) {
      throw new PhotoRejectedError("encode_failed", "the browser could not re-encode the photo");
    }

    // Even a blob larger than the input is still preferred: it is the only
    // version whose type and metadata we control. The size difference only
    // shows up for already-optimised small JPEGs.
    const pct = Math.round((1 - blob.size / file.size) * 100);
    const sizeNote =
      pct > 0
        ? `${kb(file.size)} to ${kb(blob.size)} (${pct}% smaller)`
        : `${kb(file.size)} to ${kb(blob.size)} (metadata stripped)`;

    return {
      blob,
      ext: STORED_EXT,
      contentType: STORED_CONTENT_TYPE,
      note: `${scale < 1 ? `resized to ${width}x${height}` : "re-encoded"}, ${sizeNote}`,
    };
  } finally {
    // ImageBitmap holds decoded pixels until released; <img> has no close().
    source.close?.();
  }
}

/**
 * Resize and re-encode a photo for upload.
 *
 * @returns {Promise<{blob: Blob, ext: string, contentType: string, note: string} | null>}
 * @throws {PhotoRejectedError} when the file is not a decodable image
 */
export function compressPhoto(file) {
  return reencode(file, MAX_EDGE, JPEG_QUALITY);
}

/**
 * Produce a small JPEG for the History list. Smaller than compressPhoto in
 * every dimension (256px max edge vs 2000px, same quality 0.82) so a signed
 * URL pointing here serves roughly 10x fewer bytes per photo.
 *
 * Same rejection semantics as compressPhoto. A thumb failure is already
 * non-fatal at the call site, so a refused photo simply leaves History in its
 * no-thumbnail state rather than blocking a brew from saving.
 *
 * @returns {Promise<{blob: Blob, ext: string, contentType: string, note: string} | null>}
 * @throws {PhotoRejectedError} when the file is not a decodable image
 */
export function compressThumbnail(file) {
  return reencode(file, THUMB_MAX_EDGE, THUMB_QUALITY);
}

function kb(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}
