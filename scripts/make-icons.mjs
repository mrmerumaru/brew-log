// Generates the PWA icons in public/ from the logos in image/.
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
const OUT = path.join(ROOT, "public");
const TMP = fs.mkdtempSync("/tmp/brewlog-icons-");

// Two logos: production is a gold mark on near-black, dev the inverse. Having
// visibly different home-screen icons is the only way to tell the two installs
// apart on a phone.
//
// crop is offsetY / offsetX / side, measured from each source rather than
// eyeballed: it's the largest square containing no near-white pixel, inset a
// further ~5px per side because each badge's outermost row carries a bright
// highlight that shows as a seam against flat padding. badge is the flat
// interior colour, sampled well inside that edge, so the padding is seamless.
const LOGOS = [
  {
    src: "logo.jpeg",
    prefix: "",
    crop: { y: 26, x: 684, side: 1449 },
    badge: "262626",
  },
  {
    src: "logo-dev.jpeg",
    prefix: "dev-",
    crop: { y: 38, x: 678, side: 1457 },
    badge: "bf984a",
  },
];

const sips = (...args) => execFileSync("sips", args, { stdio: ["ignore", "ignore", "pipe"] });

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

for (const { src, prefix, crop, badge: badgeColor } of LOGOS) {
  console.log(`\n${src}`);
  const full = path.join(TMP, `${prefix}full.png`);
  const badge = path.join(TMP, `${prefix}badge.png`);

  sips("-s", "format", "png", path.join(ROOT, "image", src), "--out", full);
  sips(
    "--cropOffset", String(crop.y), String(crop.x),
    "-c", String(crop.side), String(crop.side),
    full, "--out", badge,
  );

  for (const [name, size, inner] of ICONS) {
    const dest = path.join(OUT, prefix + name);
    const scaled = path.join(TMP, `s-${prefix}${name}`);
    sips("--resampleHeightWidth", String(inner), String(inner), badge, "--out", scaled);

    if (inner === size) {
      fs.copyFileSync(scaled, dest);
    } else {
      sips(
        "--padToHeightWidth", String(size), String(size),
        "--padColor", badgeColor,
        scaled, "--out", dest,
      );
    }

    const bytes = fs.statSync(dest).size;
    console.log(
      `  ${(prefix + name).padEnd(28)} ${size}x${size}  mark at ` +
        `${Math.round((inner / size) * 85)}% of width  ${(bytes / 1024).toFixed(1)} kB`,
    );
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
