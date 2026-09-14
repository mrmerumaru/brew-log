// Generates the PWA icons in public/.
//
// Run with `node scripts/make-icons.mjs` — only needed if the mark or the
// palette changes. Writing a minimal PNG encoder here rather than adding an
// image library: the icon is two shapes and a background, and this keeps the
// dependency list at four packages.
//
// The cup matches drawCup() in src/shareCard.js, so the home-screen icon, the
// share-card footer mark and the in-app rating icon are the same shape.

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

const GREEN = [47, 82, 51]; // TOKENS.green  #2F5233
const PAPER = [251, 250, 247]; // TOKENS.card   #FBFAF7

// --- PNG encoding ----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 stay zero: deflate, adaptive filtering, no interlace

  // Each scanline is prefixed with its filter byte; 0 means "none".
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- The mark --------------------------------------------------------------

/**
 * @param size    pixel dimensions
 * @param cupFrac how much of the icon the cup spans; smaller values leave the
 *                safe-zone padding a maskable icon needs, since Android crops
 *                maskable icons to a circle on some launchers.
 */
function renderIcon(size, cupFrac) {
  const SS = 4; // supersampling factor, for antialiased edges
  const rgba = Buffer.alloc(size * size * 4);

  // Cup geometry, in pixels. Proportions lifted from drawCup().
  const bodyW = size * cupFrac;
  const bodyH = bodyW * 0.89;
  const handleR = bodyW * 0.23;
  const handleW = bodyW * 0.061;
  // Centre the body plus its handle as one unit.
  const totalW = bodyW + handleR + handleW;
  const x0 = (size - totalW) / 2;
  const y0 = (size - bodyH) / 2;
  const hcx = x0 + bodyW;
  const hcy = y0 + bodyH * 0.36;

  const inCup = (px, py) => {
    // Tapered body: the sides draw in as they descend.
    if (py >= y0 && py <= y0 + bodyH) {
      const t = (py - y0) / bodyH;
      if (px >= x0 + bodyW * 0.14 * t && px <= x0 + bodyW * (1 - 0.16 * t)) return true;
    }
    // Handle: the right half of a ring.
    const dx = px - hcx;
    const dy = py - hcy;
    if (dx >= 0) {
      const r = Math.hypot(dx, dy);
      if (r >= handleR - handleW && r <= handleR + handleW) return true;
    }
    return false;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          if (inCup(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) hits += 1;
        }
      }
      const a = hits / (SS * SS);
      const i = (y * size + x) * 4;
      // Full-bleed background: iOS rounds the apple-touch-icon itself, and
      // Android masks the maskable one, so rounding it here would double up.
      for (let c = 0; c < 3; c += 1) {
        rgba[i + c] = Math.round(GREEN[c] * (1 - a) + PAPER[c] * a);
      }
      rgba[i + 3] = 255;
    }
  }

  return encodePng(size, rgba);
}

fs.mkdirSync(OUT, { recursive: true });

const icons = [
  ["icon-192.png", 192, 0.46],
  ["icon-512.png", 512, 0.46],
  // Tighter, so the mark survives an aggressive launcher crop.
  ["icon-maskable-512.png", 512, 0.34],
  ["apple-touch-icon.png", 180, 0.46],
  ["favicon-32.png", 32, 0.5],
];

for (const [name, size, cupFrac] of icons) {
  const png = renderIcon(size, cupFrac);
  fs.writeFileSync(path.join(OUT, name), png);
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`);
}
