// Generates the PWA icons in public/ from image/logo.jpeg.
//
// Run with `node scripts/make-icons.mjs` — only needed when the logo changes.
// Uses macOS `sips`, which is built in, rather than adding an image dependency;
// the generated PNGs are committed, so this only has to run on a Mac.
//
// What it does and why:
//
// The source is a landscape JPEG with the dark rounded badge sitting in white
// padding. Three things have to happen:
//
//   1. Crop to the badge. CROP below is the largest square centred on the gold
//      artwork that contains no near-white pixel on any edge — measured from
//      the source, not eyeballed. Cropping any wider catches the badge's
//      rounded corners and pulls white into the icon's corners.
//   2. Pad back out with the badge colour. The clean square leaves the artwork
//      at 85% of the width, which is tight for an app icon; padding restores
//      roughly the ~79% the badge was designed with.
//   3. Output PNG. JPEG has no alpha and its ringing artefacts are very visible
//      on flat colour at small sizes.
//
// The rounded corners are deliberately cropped away rather than preserved: iOS
// masks the apple-touch-icon and Android masks the maskable icon, so keeping
// them would round an already-rounded shape.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "image", "logo.jpeg");
const OUT = path.join(ROOT, "public");
const TMP = fs.mkdtempSync("/tmp/brewlog-icons-");

// Measured from the source: offsetY, offsetX, side. The largest white-free
// square is 1459 at (679, 21); this insets 5px further on each side because the
// badge's outermost row carries a bright highlight that shows as a seam against
// the flat padding. The interior is flat to within 4/255 from there inward.
const CROP = { y: 26, x: 684, side: 1449 };
// The flat interior colour, so padding is seamless. Sampled well inside the
// edge — a sample taken at the very corner picks up that highlight instead.
const BADGE = "262626";

const sips = (...args) => execFileSync("sips", args, { stdio: ["ignore", "ignore", "pipe"] });

const badge = path.join(TMP, "badge.png");
sips("-s", "format", "png", SRC, "--out", path.join(TMP, "full.png"));
sips(
  "--cropOffset", String(CROP.y), String(CROP.x),
  "-c", String(CROP.side), String(CROP.side),
  path.join(TMP, "full.png"), "--out", badge,
);

// [filename, size, inner] — inner is the badge's rendered width before padding.
// 93% of the size keeps the artwork near the original 79%; the maskable icon
// goes much smaller so the mark survives a circular launcher crop; the favicon
// isn't padded at all, because at 32px every pixel of the mark counts.
const ICONS = [
  ["icon-192.png", 192, 179],
  ["icon-512.png", 512, 476],
  ["icon-maskable-512.png", 512, 361],
  ["apple-touch-icon.png", 180, 167],
  ["favicon-32.png", 32, 32],
];

fs.mkdirSync(OUT, { recursive: true });

for (const [name, size, inner] of ICONS) {
  const dest = path.join(OUT, name);
  const scaled = path.join(TMP, `s-${name}`);
  sips("--resampleHeightWidth", String(inner), String(inner), badge, "--out", scaled);

  if (inner === size) {
    fs.copyFileSync(scaled, dest);
  } else {
    sips(
      "--padToHeightWidth", String(size), String(size),
      "--padColor", BADGE,
      scaled, "--out", dest,
    );
  }

  const bytes = fs.statSync(dest).size;
  console.log(
    `${name.padEnd(24)} ${size}x${size}  mark at ${Math.round((inner / size) * 85)}% ` +
      `of width  ${(bytes / 1024).toFixed(1)} kB`,
  );
}

fs.rmSync(TMP, { recursive: true, force: true });
