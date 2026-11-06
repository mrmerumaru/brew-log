// Two-language support: English and Bahasa Indonesia.
//
// Deliberately not a library. The app has one React tree and no server
// rendering, so a module-level store plus useSyncExternalStore covers live
// switching in ~30 lines, where react-i18next would add a dependency, a
// provider, and a suspense story for no benefit we actually use.
//
// Two things leave this file:
//
//   * `t(key)` for UI chrome. Keys are dotted and grouped by the screen that
//     owns them, so a missing translation is obvious from the key alone.
//   * `presetLabel(value)` for the preset values that get STORED in Postgres
//     (methods, drinks, milk kinds, processes, roasts, units, flavour tags).
//
// The second one matters: those values are data, not copy. `Insights` groups
// by the raw `method`, `sameMethod()` decides carry-forward by comparing raw
// strings, and History's filter chips are derived from what's in the rows. So
// Indonesian is applied at *display* time only — the database keeps the
// canonical value and an existing log stays one vocabulary. A user switching
// to Bahasa sees "Americano Es"; the row still says "Iced Americano", and
// switching back changes nothing.
//
// Presets with no natural Indonesian word are intentionally absent from the
// map below: "Pourover", "French Press", "Washed", "Honey" and "Light" are
// what Indonesian specialty bags actually print, so passing them through is
// more useful than inventing a translation. Anything absent from the map is
// returned unchanged, which also covers user-typed values.

import { useSyncExternalStore } from "react";

export const LANGS = ["en", "id"];

// Short forms for the segmented control in the header.
export const LANG_LABELS = { en: "EN", id: "ID" };

// Long forms for the accessible name of each button.
export const LANG_NAMES = { en: "English", id: "Bahasa Indonesia" };

export const DEFAULT_LANG = "en";

const STORAGE_KEY = "brew-log:lang:v1";

// BCP 47 tags for Intl. Dates follow the app's language rather than the
// machine's, so an English UI can't end up with Indonesian month names just
// because the phone is set to id-ID — which is exactly what passing
// `undefined` to toLocaleString did.
const LOCALES = { en: "en-GB", id: "id-ID" };

export const STRINGS = {
  en: {
    // --- Header / tabs -----------------------------------------------------
    "app.tab.log": "Log",
    "app.tab.editing": "Editing",
    "app.tab.history": "History",
    "app.tab.insights": "Insights",
    "app.export": "Export",
    "app.signOut": "Sign out",
    "app.dev": "Dev",
    "app.devTitle": "Not the version your friends use",
    "app.language": "Language",
    "app.loading": "Loading…",
    "app.exportTitle.loading": "Loading…",
    "app.exportTitle.empty": "Log a brew first",
    "app.exportTitle.download": "Download all {n} brews as {fmt}",

    // --- Login -------------------------------------------------------------
    "login.tagline": "A coffee consistency tracker.",
    "login.heading": "Welcome back",
    "login.blurb":
      "Sign in to keep every brew in one place — method, beans, parameters, taste.",
    "login.google": "Continue with Google",
    "login.googleNote": "Google only — no password to manage.",

    // --- Crash screen ------------------------------------------------------
    "error.title": "Something went wrong",
    "error.body":
      "The app hit an error it couldn't recover from. Nothing you'd already saved is affected — reloading usually clears it.",
    "error.where": "Where it happened",
    "error.reload": "Reload",

    // --- Form steps --------------------------------------------------------
    "step.drink": "Drink",
    "step.method": "Method",
    "step.beans": "Beans",
    "step.milk": "Milk",
    "step.equipment": "Equipment",
    "step.parameters": "Parameters",
    "step.tasting": "Tasting Notes",

    // --- Field labels ------------------------------------------------------
    "field.whatMake": "What did you make?",
    "field.whichMethod": "Which method?",
    "field.roastery": "Roastery",
    "field.origin": "Origin",
    "field.proportion": "Share",
    "field.lotBean": "Lot / bean",
    "field.process": "Process",
    "field.nameRoaster": "Name / roaster",
    "field.roastDate": "Roast date",
    "field.brand": "Brand",
    "field.kind": "Kind",
    "field.brewerBrand": "Brewer brand",
    "field.brewerModel": "Brewer model",
    "field.grinder": "Grinder",
    "field.dose": "Dose",
    "field.water": "Water",
    "field.temp": "Temp",
    "field.time": "Time",
    "field.grindSize": "Grind size",
    "field.unit": "Unit",
    "field.microAdjust": "Micro-adjust",
    "field.microUnit": "Micro unit",
    "field.at": "At",
    "field.optional": "Optional",
    "field.aria.brewTimeSeconds": "Brew time seconds",
    "field.aria.pourMinutes": "Pour {n} minutes",
    "field.aria.pourSeconds": "Pour {n} seconds",

    // --- Units -------------------------------------------------------------
    "unit.hours": "hours",
    "unit.min": "min",
    "unit.sec": "sec",
    "unit.hourShort": "h",
    "unit.minShort": "m",

    // --- Form actions and messages -----------------------------------------
    "form.startBlank": "Start blank",
    "form.setupCarried": "SETUP CARRIED OVER",
    "form.brewingAgain": "BREWING THIS AGAIN",
    "form.addBean": "+ Add bean",
    "form.total": "TOTAL",
    "form.addPour": "+ Add pour",
    "form.pourN": "POUR {n}",
    "form.removePour": "Remove pour {n}",
    "form.pourNoWater":
      "Pour 1 has no water recorded — this brew won't be reproducible.",
    "form.next": "Next",
    "form.back": "Back",
    "form.saveBrew": "Save Brew",
    "form.saveChanges": "Save Changes",
    "form.saving": "Saving…",
    "form.saved": "Saved ✓",
    "form.cancel": "Cancel",
    "form.cancelEditing": "Cancel editing",
    "form.shareSaved": "Share the brew you just saved",
    "form.shareFirst": "Save a brew first, then share it",
    "form.editBrew": "Edit Brew",
    "form.brewSaved": "Brew saved",
    "form.changesSaved": "Changes saved",
    "form.notesPlaceholder": "Anything else worth remembering about this cup…",
    "form.addTag": "Add tag",
    "form.addTagPlaceholder": "Add tag…",
    "form.newFlavorTag": "New flavour tag",
    "form.removeTag": "Remove tag",
    "form.ratio": "RATIO",
    "form.pours": "POURS",
    "form.rating": "RATING",
    "form.beanN": "BEAN {n}",
    "form.removeBean": "Remove bean {n}",
    "form.customTagsCap": "{n}/{n} CUSTOM TAGS",
    "form.photoAlt": "Brew",
    "form.aria.rating": "{n} of 5 cups",
    "form.aria.removeCustomTag": "Remove custom tag {label}",
    "form.aria.toggleCustomTag": "Toggle {label}",
    "form.nav.step": "Step {n}: {name}",
    "form.tag.cap": "You can keep up to {n} custom tags.",
    "form.err.photoUpload": "{verb}, but the photo didn't upload: {msg}",
    "form.err.photoLink": "{verb} and photo uploaded, but linking them failed: {msg}",
    "form.err.thumb": "{verb} and photo saved, but the thumbnail didn't: {msg}",
    "form.err.thumbLink": "{verb} and photo saved, but linking the thumbnail failed: {msg}",

    // --- Short step names in the form's own progress dots ------------------
    "nav.drink": "Drink",
    "nav.beans": "Beans",
    "nav.equipment": "Equipment",
    "nav.brew": "Brew",
    "nav.taste": "Taste",
    "form.err.signedOut":
      "You're not signed in any more. Reload the page and sign in again.",
    "form.err.save": "Something went wrong saving this brew.",
    "form.tag.builtin": "Already in the built-in list.",
    "form.tag.duplicate": "You've already added that tag.",
    "form.tag.invalid": "Tags can't be empty or longer than 30 characters.",
    "form.tag.failed": "Couldn't add that tag.",

    // --- History -----------------------------------------------------------
    "history.search": "Search beans, origin, roaster…",
    "history.min": "MIN",
    "history.clearFilters": "Clear filters",
    "history.expandAll": "Expand all",
    "history.collapseAll": "Collapse all",
    "history.collapse": "Collapse",
    "history.refresh": "Refresh",
    "history.deleteConfirm": "Delete?",
    "history.deleting": "Deleting…",
    "history.editBrew": "Edit brew",
    "history.deleteBrew": "Delete brew",
    "history.shareBrew": "Share brew",
    "history.brewAgain": "Brew this again",
    "history.noBrews": "No brews yet. Log one and it'll show up here.",
    "history.noMatch": "No brews match those filters.",
    "history.noNotes": "No tasting notes",
    "history.noBean": "No bean recorded",
    "history.brewFallback": "Brew",
    "history.count": "{n} brews",
    "history.meta.ratio": "RATIO",
    "history.meta.dose": "DOSE",
    "history.meta.temp": "TEMP",
    "history.meta.time": "TIME",
    "history.meta.beans": "BEANS",
    "history.meta.grind": "GRIND",
    "history.meta.micro": "MICRO",
    "history.meta.offRoast": "OFF ROAST",
    "history.pours": "POURS",
    "history.aria.minCups": "At least {n} cups",
    "history.countOf": "{shown} of {total} brews",
    "history.delete": "Delete",
    "history.unit.days": "d",
    "history.err.shareCard": "Couldn't prepare the share card: {msg}",
    "history.err.delete": "Couldn't delete that brew: {msg}",
    "history.err.photoLeft":
      "Brew deleted, but its photo is still in storage ({msg}). If this keeps happening, run supabase/002-photo-delete-policy.sql.",
    "history.err.thumbLeft":
      "Brew deleted, but its thumbnail is still in storage ({msg}). If this keeps happening, run supabase/003-thumb-path.sql.",
    "history.aria.toggle": "{name} — tap to {action}",
    "history.action.expand": "expand",
    "history.action.collapse": "collapse",
    "history.aria.brewAgain": "Brew this {name} again",
    "history.aria.share": "Share this {name}",
    "history.aria.edit": "Edit this {name}",
    "history.aria.delete": "Delete this {name}",

    // --- Insights ----------------------------------------------------------
    "insights.brews": "BREWS",
    "insights.average": "AVERAGE",
    "insights.goodAndUp": "{n}★ AND UP",
    "insights.rated": "{n} rated",
    "insights.nothingYet":
      "Nothing to read yet. Log a few brews and this fills in.",
    "insights.bestShareTitle": "What your best cups share",
    "insights.notEnough":
      "Not enough to compare yet. This needs at least {min} brews rated {good}★ or above and {min} below — you have {goodCount} and {restCount}. Rating honestly on both sides is what makes the comparison work.",
    "insights.rest": "REST",
    "insights.fromContrast":
      "From {good} brews at {rating}★ or above against {rest} below.",
    "insights.grindLeftOut":
      " Grind is left out — you've used {n} grinders, and the numbers don't mean the same thing on each.",
    "insights.tastesLikeBest": "Tastes like your best",
    "insights.byMethod": "By method",
    "insights.byBeans": "By beans",
    "insights.byGrinder": "By grinder",
    "insights.worthRepeating": "Worth repeating",
    "insights.noMethod": "No method has {n} rated brews yet.",
    "insights.noBag": "No bag has {n} rated brews yet.",

    // --- Share sheet -------------------------------------------------------
    "share.title": "Share brew",
    "share.close": "Close",
    "share.zoom": "Zoom photo",
    "share.reset": "Reset",
    "share.dragHint": "Drag the photo to reposition it.",
    "share.zoomHint": "Zoom in to reposition the photo.",
    "share.shareCard": "Share this card",
    "share.sharing": "Sharing…",
    "share.downloaded":
      "Saved to your downloads — this browser can't share files directly.",
    "share.couldntRender": "Couldn't render the card.",
    "share.zoomLabel": "ZOOM",
    "share.err.draw": "Couldn't draw the card: {msg}",
    "share.err.share": "Couldn't share: {msg}",
    "share.aria.shareThis": "Share this {name}",

    // --- Text drawn onto the share card ------------------------------------
    "card.brewLog": "BREW LOG",
    "card.ratio": "RATIO",
    "card.dose": "DOSE",
    "card.temp": "TEMP",
    "card.time": "TIME",
    "card.story": "Story",
    "card.post": "Post",
    "card.storyNote": "Instagram Stories, Reels, TikTok",
    "card.postNote": "Instagram feed, X, Threads",

    // --- Parameter names (rendered from stats.js by key) -------------------
    "stats.dose": "Dose",
    "stats.ratio": "Ratio",
    "stats.temp": "Temp",
    "stats.time": "Time",
    "stats.grind": "Grind",
  },

  id: {
    // --- Header / tabs -----------------------------------------------------
    "app.tab.log": "Catat",
    "app.tab.editing": "Mengubah",
    "app.tab.history": "Riwayat",
    "app.tab.insights": "Wawasan",
    "app.export": "Ekspor",
    "app.signOut": "Keluar",
    "app.dev": "Dev",
    "app.devTitle": "Bukan versi yang dipakai teman-teman",
    "app.language": "Bahasa",
    "app.loading": "Memuat…",
    "app.exportTitle.loading": "Memuat…",
    "app.exportTitle.empty": "Catat seduhan dulu",
    "app.exportTitle.download": "Unduh semua {n} seduhan sebagai {fmt}",

    // --- Login -------------------------------------------------------------
    "login.tagline": "Pelacak konsistensi kopi.",
    "login.heading": "Selamat datang kembali",
    "login.blurb":
      "Masuk untuk menyimpan setiap seduhan di satu tempat — metode, biji, parameter, rasa.",
    "login.google": "Lanjutkan dengan Google",
    "login.googleNote": "Hanya lewat Google — tidak perlu kata sandi.",

    // --- Crash screen ------------------------------------------------------
    "error.title": "Terjadi kesalahan",
    "error.body":
      "Aplikasi mengalami kesalahan yang tidak bisa dipulihkan. Data yang sudah tersimpan tidak terpengaruh — memuat ulang biasanya menyelesaikannya.",
    "error.where": "Lokasi kesalahan",
    "error.reload": "Muat ulang",

    // --- Form steps --------------------------------------------------------
    "step.drink": "Minuman",
    "step.method": "Metode",
    "step.beans": "Biji",
    "step.milk": "Susu",
    "step.equipment": "Peralatan",
    "step.parameters": "Parameter",
    "step.tasting": "Catatan Rasa",

    // --- Field labels ------------------------------------------------------
    "field.whatMake": "Sedang membuat apa?",
    "field.whichMethod": "Metode apa?",
    "field.roastery": "Roastery",
    "field.origin": "Asal",
    "field.proportion": "Proporsi",
    "field.lotBean": "Lot / biji",
    "field.process": "Proses",
    "field.nameRoaster": "Nama / roastery",
    "field.roastDate": "Tanggal sangrai",
    "field.brand": "Merek",
    "field.kind": "Jenis",
    "field.brewerBrand": "Merek alat seduh",
    "field.brewerModel": "Model alat seduh",
    "field.grinder": "Grinder",
    "field.dose": "Dosis",
    "field.water": "Air",
    "field.temp": "Suhu",
    "field.time": "Waktu",
    "field.grindSize": "Ukuran giling",
    "field.unit": "Satuan",
    "field.microAdjust": "Setelan mikro",
    "field.microUnit": "Satuan mikro",
    "field.at": "Pada",
    "field.optional": "Opsional",
    "field.aria.brewTimeSeconds": "Detik waktu seduh",
    "field.aria.pourMinutes": "Menit tuangan {n}",
    "field.aria.pourSeconds": "Detik tuangan {n}",

    // --- Units -------------------------------------------------------------
    "unit.hours": "jam",
    "unit.min": "mnt",
    "unit.sec": "dtk",
    "unit.hourShort": "j",
    "unit.minShort": "m",

    // --- Form actions and messages -----------------------------------------
    "form.startBlank": "Mulai dari kosong",
    "form.setupCarried": "PERALATAN DIBAWA",
    "form.brewingAgain": "MENYEDUH INI LAGI",
    "form.addBean": "+ Tambah biji",
    "form.total": "TOTAL",
    "form.addPour": "+ Tambah tuangan",
    "form.pourN": "TUANGAN {n}",
    "form.removePour": "Hapus tuangan {n}",
    "form.pourNoWater":
      "Tuangan 1 belum diisi airnya — seduhan ini tidak bisa diulang persis.",
    "form.next": "Lanjut",
    "form.back": "Kembali",
    "form.saveBrew": "Simpan Seduhan",
    "form.saveChanges": "Simpan Perubahan",
    "form.saving": "Menyimpan…",
    "form.saved": "Tersimpan ✓",
    "form.cancel": "Batal",
    "form.cancelEditing": "Batal mengubah",
    "form.shareSaved": "Bagikan seduhan yang baru disimpan",
    "form.shareFirst": "Simpan seduhan dulu, lalu bagikan",
    "form.editBrew": "Ubah Seduhan",
    "form.brewSaved": "Seduhan tersimpan",
    "form.changesSaved": "Perubahan tersimpan",
    "form.notesPlaceholder": "Hal lain yang perlu diingat tentang cangkir ini…",
    "form.addTag": "Tambah tag",
    "form.addTagPlaceholder": "Tambah tag…",
    "form.newFlavorTag": "Tag rasa baru",
    "form.removeTag": "Hapus tag",
    "form.ratio": "RASIO",
    "form.pours": "TUANGAN",
    "form.rating": "PENILAIAN",
    "form.beanN": "BIJI {n}",
    "form.removeBean": "Hapus biji {n}",
    "form.customTagsCap": "{n}/{n} TAG KUSTOM",
    "form.photoAlt": "Seduhan",
    "form.aria.rating": "{n} dari 5 cangkir",
    "form.aria.removeCustomTag": "Hapus tag kustom {label}",
    "form.aria.toggleCustomTag": "Aktifkan {label}",
    "form.nav.step": "Langkah {n}: {name}",
    "form.tag.cap": "Maksimal {n} tag kustom.",
    "form.err.photoUpload": "{verb}, tetapi foto gagal diunggah: {msg}",
    "form.err.photoLink": "{verb} dan foto terunggah, tetapi gagal ditautkan: {msg}",
    "form.err.thumb": "{verb} dan foto tersimpan, tetapi thumbnail gagal dibuat: {msg}",
    "form.err.thumbLink": "{verb} dan foto tersimpan, tetapi tautan thumbnail gagal: {msg}",

    "nav.drink": "Minuman",
    "nav.beans": "Biji",
    "nav.equipment": "Peralatan",
    "nav.brew": "Seduh",
    "nav.taste": "Rasa",
    "form.err.signedOut":
      "Sesi sudah berakhir. Muat ulang halaman lalu masuk lagi.",
    "form.err.save": "Terjadi kesalahan saat menyimpan seduhan ini.",
    "form.tag.builtin": "Sudah ada di daftar bawaan.",
    "form.tag.duplicate": "Tag itu sudah ditambahkan.",
    "form.tag.invalid": "Tag tidak boleh kosong atau lebih dari 30 karakter.",
    "form.tag.failed": "Tag itu tidak bisa ditambahkan.",

    // --- History -----------------------------------------------------------
    "history.search": "Cari biji, asal, roastery…",
    "history.min": "MIN",
    "history.clearFilters": "Hapus filter",
    "history.expandAll": "Buka semua",
    "history.collapseAll": "Tutup semua",
    "history.collapse": "Tutup",
    "history.refresh": "Muat ulang",
    "history.deleteConfirm": "Hapus?",
    "history.deleting": "Menghapus…",
    "history.editBrew": "Ubah seduhan",
    "history.deleteBrew": "Hapus seduhan",
    "history.shareBrew": "Bagikan seduhan",
    "history.brewAgain": "Seduh lagi",
    "history.noBrews": "Belum ada seduhan. Catat satu, nanti muncul di sini.",
    "history.noMatch": "Tidak ada seduhan yang cocok dengan filter itu.",
    "history.noNotes": "Tidak ada catatan rasa",
    "history.noBean": "Asal biji belum dicatat",
    "history.brewFallback": "Seduhan",
    "history.count": "{n} seduhan",
    "history.meta.ratio": "RASIO",
    "history.meta.dose": "DOSIS",
    "history.meta.temp": "SUHU",
    "history.meta.time": "WAKTU",
    "history.meta.beans": "BIJI",
    "history.meta.grind": "GILINGAN",
    "history.meta.micro": "MIKRO",
    "history.meta.offRoast": "SEJAK SANGRAI",
    "history.pours": "TUANGAN",
    "history.aria.minCups": "Minimal {n} cangkir",
    "history.countOf": "{shown} dari {total} seduhan",
    "history.delete": "Hapus",
    "history.unit.days": "h",
    "history.err.shareCard": "Gagal menyiapkan kartu bagikan: {msg}",
    "history.err.delete": "Gagal menghapus seduhan itu: {msg}",
    "history.err.photoLeft":
      "Seduhan terhapus, tetapi fotonya masih ada di storage ({msg}). Kalau ini terus terjadi, jalankan supabase/002-photo-delete-policy.sql.",
    "history.err.thumbLeft":
      "Seduhan terhapus, tetapi thumbnail-nya masih ada di storage ({msg}). Kalau ini terus terjadi, jalankan supabase/003-thumb-path.sql.",
    "history.aria.toggle": "{name} — ketuk untuk {action}",
    "history.action.expand": "buka",
    "history.action.collapse": "tutup",
    "history.aria.brewAgain": "Seduh {name} ini lagi",
    "history.aria.share": "Bagikan {name} ini",
    "history.aria.edit": "Ubah {name} ini",
    "history.aria.delete": "Hapus {name} ini",

    // --- Insights ----------------------------------------------------------
    "insights.brews": "SEDUHAN",
    "insights.average": "RATA-RATA",
    "insights.goodAndUp": "{n}★ KE ATAS",
    "insights.rated": "{n} dinilai",
    "insights.nothingYet":
      "Belum ada yang bisa dibaca. Catat beberapa seduhan, nanti terisi.",
    "insights.bestShareTitle": "Kesamaan cangkir terbaik",
    "insights.notEnough":
      "Belum cukup untuk dibandingkan. Butuh minimal {min} seduhan bernilai {good}★ ke atas dan {min} di bawahnya — sekarang ada {goodCount} dan {restCount}. Menilai dengan jujur di kedua sisi yang membuat perbandingan ini berguna.",
    "insights.rest": "LAINNYA",
    "insights.fromContrast":
      "Dari {good} seduhan bernilai {rating}★ ke atas dibandingkan {rest} di bawahnya.",
    "insights.grindLeftOut":
      " Gilingan tidak diikutkan — sudah dipakai {n} grinder, dan angkanya tidak sama artinya di tiap alat.",
    "insights.tastesLikeBest": "Rasa cangkir terbaik",
    "insights.byMethod": "Per metode",
    "insights.byBeans": "Per biji",
    "insights.byGrinder": "Per grinder",
    "insights.worthRepeating": "Layak diulang",
    "insights.noMethod": "Belum ada metode dengan {n} seduhan bernilai.",
    "insights.noBag": "Belum ada biji dengan {n} seduhan bernilai.",

    // --- Share sheet -------------------------------------------------------
    "share.title": "Bagikan seduhan",
    "share.close": "Tutup",
    "share.zoom": "Perbesar foto",
    "share.reset": "Atur ulang",
    "share.dragHint": "Geser foto untuk mengatur posisinya.",
    "share.zoomHint": "Perbesar untuk mengatur posisi foto.",
    "share.shareCard": "Bagikan kartu ini",
    "share.sharing": "Membagikan…",
    "share.downloaded":
      "Tersimpan di unduhan — browser ini tidak bisa membagikan berkas langsung.",
    "share.couldntRender": "Kartu tidak bisa dibuat.",
    "share.zoomLabel": "PERBESAR",
    "share.err.draw": "Gagal menggambar kartu: {msg}",
    "share.err.share": "Gagal membagikan: {msg}",
    "share.aria.shareThis": "Bagikan {name} ini",

    // --- Text drawn onto the share card ------------------------------------
    "card.brewLog": "BREW LOG",
    "card.ratio": "RASIO",
    "card.dose": "DOSIS",
    "card.temp": "SUHU",
    "card.time": "WAKTU",
    "card.story": "Story",
    "card.post": "Postingan",
    "card.storyNote": "Instagram Stories, Reels, TikTok",
    "card.postNote": "Instagram feed, X, Threads",

    // --- Parameter names ---------------------------------------------------
    "stats.dose": "Dosis",
    "stats.ratio": "Rasio",
    "stats.temp": "Suhu",
    "stats.time": "Waktu",
    "stats.grind": "Gilingan",
  },
};

// Values that get written to Postgres. Only entries whose Indonesian differs
// are listed; everything else falls through unchanged (see the file header).
// `clicks` -> `klik` covers both grind_unit and micro_adjustment_unit, which is
// why the two unit lists share one entry rather than one each.
const PRESETS = {
  id: {
    // Methods
    Turkish: "Kopi Turki",
    // Drinks
    "Iced Americano": "Americano Es",
    "Iced Latte": "Latte Es",
    "Black Coffee": "Kopi Hitam",
    "Iced Coffee": "Kopi Es",
    // Milk
    "Fresh Milk": "Susu Segar",
    "Full Cream": "Susu Full Cream",
    "Low Fat": "Rendah Lemak",
    "Lactose Free": "Bebas Laktosa",
    Soy: "Kedelai",
    Coconut: "Kelapa",
    // Flavour tags
    Fruity: "Buah",
    Nutty: "Kacang",
    Chocolatey: "Cokelat",
    Acidic: "Asam",
    Bitter: "Pahit",
    Sweet: "Manis",
    Earthy: "Tanah",
    // Units (grind_unit and micro_adjustment_unit)
    clicks: "klik",
    numbers: "angka",
    rotations: "rotasi",
    microns: "mikron",
    marks: "tanda",
    steps: "langkah",
    // Sample placeholders worth localising
    Siphon: "Sifon",
    Brazil: "Brasil",
    Ethiopia: "Etiopia",
  },
};

// --- The store -------------------------------------------------------------

function storage() {
  try {
    // `window` rather than the bare global: Node 22 exposes a `localStorage`
    // that warns on access, and in a browser the real one is always on window.
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Privacy modes throw on access. No storage just means no persistence.
  }
  return null;
}

function isLang(value) {
  return LANGS.includes(value);
}

// Stored choice wins; otherwise follow the browser, so someone opening this
// from an Indonesian phone in Indonesia starts in Bahasa rather than having to
// find the toggle first.
function initialLang() {
  const saved = storage()?.getItem?.(STORAGE_KEY);
  if (isLang(saved)) return saved;

  const nav = typeof navigator !== "undefined" ? navigator : null;
  const preferred = nav?.languages?.[0] ?? nav?.language;
  if (typeof preferred === "string" && preferred.toLowerCase().startsWith("id")) {
    return "id";
  }
  return DEFAULT_LANG;
}

let current = initialLang();
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn();
}

/** Current language code. Read by t() and by anything outside React. */
export function getLang() {
  return current;
}

/**
 * Switch language. Safe to call from anywhere; every subscribed component
 * re-renders. No-op when the language is already active, so a stray click
 * doesn't churn the tree.
 */
export function setLang(next) {
  if (!isLang(next) || next === current) return;
  current = next;
  try {
    storage()?.setItem?.(STORAGE_KEY, next);
  } catch {
    // Storage denied — the switch still applies for this session.
  }
  applyDocumentLang();
  emit();
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Subscribe a component to the active language. Call this in any component
 * that renders translated text — it's what makes switching live rather than
 * needing a reload.
 */
export function useLang() {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** Keep <html lang> honest for screen readers and hyphenation. */
export function applyDocumentLang() {
  if (typeof document !== "undefined") {
    document.documentElement.lang = current;
  }
}

/** The BCP 47 tag to hand to toLocaleString / toLocaleDateString. */
export function localeTag() {
  return LOCALES[current] ?? LOCALES[DEFAULT_LANG];
}

// --- Translation -----------------------------------------------------------

/**
 * Look up a UI string in the active language.
 *
 * Falls back to English and then to the key itself, so a missing translation
 * shows up as a visible key rather than a blank space or a crash — and a
 * developer adding a key to one language only still gets a working UI.
 *
 * `{name}` placeholders are filled from `vars`.
 */
export function t(key, vars) {
  const table = STRINGS[current] ?? STRINGS[DEFAULT_LANG];
  const raw = table?.[key] ?? STRINGS[DEFAULT_LANG][key];
  if (raw == null) return key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

// Built once per language on first use: an exact-value lookup misses
// hand-typed casing ("espresso", "Espresso"), and the whole point of a
// pass-through map is that user data still reads naturally.
let presetIndex = null;
let presetIndexLang = null;

function presetLookup() {
  if (presetIndexLang !== current) {
    presetIndex = new Map();
    for (const [from, to] of Object.entries(PRESETS[current] ?? {})) {
      presetIndex.set(from.toLowerCase(), to);
    }
    presetIndexLang = current;
  }
  return presetIndex;
}

/**
 * Display form of a stored preset value — a method, drink, milk kind, process,
 * roast, unit or flavour tag.
 *
 * Returns the value unchanged when it isn't a known preset, which covers
 * custom unit names, tags the user invented, and hand-typed methods. This is a
 * display-only mapping: never write its result back to the database.
 */
export function presetLabel(value) {
  if (value == null) return value;
  const key = String(value).trim();
  if (!key) return value;
  return presetLookup().get(key.toLowerCase()) ?? value;
}

/**
 * What to call a brew inside a sentence: its drink, then its method, then a
 * neutral fallback, so a phrase never comes out half-empty.
 */
export function brewName(brew) {
  return brew?.drink || brew?.method || t("history.brewFallback");
}

/**
 * Translate a labelled list of values, preserving each value. Used by the chip
 * rows, where the label is translated but the value that gets stored is not —
 * pass the *value* to the setter, not the label.
 */
export function presetOptions(values) {
  return values.map((value) => ({ value, label: presetLabel(value) }));
}
