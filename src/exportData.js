// Brew export — JSON or CSV, all the brews the signed-in user has logged.
//
// Photos stay where they are (Supabase Storage); the export records only the
// storage path. Re-signing on demand would give a URL that expires within an
// hour, which isn't useful in a saved file. A future "Export with photos"
// can pull the blobs and bundle them; for now the export is small and instant.

import { csvCell } from "./csvCell";

const EXPORT_VERSION = 1;

// Columns included in the CSV, in display order. Kept in one place so the JSON
// shape and the CSV header can never drift apart for the fields they share.
export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "drink",
  "method",
  "machine_brand",
  "machine_model",
  "grinder",
  "grind_size",
  "grind_unit",
  "bean_name",
  "bean_type",
  "origin",
  "process",
  "roast_level",
  "roast_date",
  "milk_brand",
  "milk_type",
  "dose_g",
  "water_g",
  "water_temp_c",
  "brew_time_s",
  "pours",
  "blend_components",
  "flavor_tags",
  "rating",
  "notes",
  "photo_path",
];

// `null` and `undefined` both flatten to `null` in the JSON, and to an empty
// cell in the CSV. Spreadsheets treat both the same; tools reading the JSON
// can distinguish them by the column being absent (we keep it present).
function toExportRow(brew) {
  return {
    ...brew,
    pours: Array.isArray(brew?.pours) ? brew.pours : null,
    blend_components: Array.isArray(brew?.blend_components) ? brew.blend_components : null,
    flavor_tags: Array.isArray(brew?.flavor_tags) ? brew.flavor_tags : null,
  };
}

export function brewsToExportJson(rows) {
  return {
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    total: rows.length,
    brews: rows.map(toExportRow),
  };
}

// "Fruity|Nutty" — pipe rather than comma because comma is the CSV separator.
function flavorTagsCell(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  return tags.join("|");
}

// "0:00/50;0:45/100" — slash inside a pour, semicolon between pours. Same
// reason as flavor tags: a delimiter that won't collide with the CSV comma.
function poursCell(pours) {
  if (!Array.isArray(pours) || pours.length === 0) return null;
  const parts = pours
    .map((p) => {
      const t = p?.time_s == null ? "" : `${Math.floor(p.time_s / 60)}:${String(p.time_s % 60).padStart(2, "0")}`;
      const w = p?.water_g == null ? "" : `${p.water_g}`;
      return [t, w].filter(Boolean).join("/");
    })
    .filter(Boolean);
  return parts.length ? parts.join(";") : null;
}

// blend_components is nested JSON; keeping it as a JSON string inside the
// CSV cell is the only lossless option without bloating the file with a
// many-to-many table. Spreadsheets will display it as text, but a JSON-aware
// tool can parse it back.
function blendCell(components) {
  if (!Array.isArray(components) || components.length === 0) return null;
  return JSON.stringify(components);
}

export function brewsToExportCsv(rows) {
  const lines = [EXPORT_COLUMNS.join(",")];

  for (const brew of rows) {
    const flat = toExportRow(brew);
    const cell = (key) => {
      switch (key) {
        case "flavor_tags":
          return flavorTagsCell(flat.flavor_tags);
        case "pours":
          return poursCell(flat.pours);
        case "blend_components":
          return blendCell(flat.blend_components);
        default:
          return flat[key] ?? null;
      }
    };
    lines.push(EXPORT_COLUMNS.map((h) => csvCell(cell(h))).join(","));
  }

  // CRLF for spreadsheet compatibility (Excel on Windows reads LF inconsistently).
  return lines.join("\r\n") + "\r\n";
}

// csvCell lives in ./csvCell so its quoting and formula-injection rules can
// be unit-tested without a browser. It's imported at the top of this file.

export function downloadExport(rows, format) {
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const blob = new Blob([brewsToExportCsv(rows)], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `brew-log-export-${stamp}.csv`);
  } else {
    const blob = new Blob([JSON.stringify(brewsToExportJson(rows), null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, `brew-log-export-${stamp}.json`);
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so Safari has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
