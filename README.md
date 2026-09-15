# Brew Log

**Live:** https://brew-log-xi.vercel.app/

A coffee consistency tracker. Log every variable of a brew, attach a photo of the
cup, and look back at what produced your best results.

React (Vite) + Supabase (Postgres, Auth, Storage). No custom backend server — the
app talks to Supabase directly, secured by row-level security.

See [docs/](docs/) for the PRD, system design, and the original step-by-step
implementation guides.

## Setup

### 1. Install Node.js

Not currently installed on this machine. Download the **LTS** version from
[nodejs.org](https://nodejs.org), or with Homebrew:

```bash
brew install node
```

Verify with `node -v` — you should see a version number.

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com), named `brew-log`.
2. **Storage → New bucket**, named `brew-photos`, with "Public bucket" **off**.
3. **SQL Editor → New query**, paste the contents of
   [supabase/schema.sql](supabase/schema.sql), and Run.
4. **Project Settings → API**, copy the **Project URL** and **anon public** key.

### 4. Add your keys

Open `.env.local` (already created, and gitignored) and fill in the two values:

```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Never commit this file. Vite only reads it at startup, so restart the dev server
after editing it.

### 5. Run it

```bash
npm run dev
```

Open the printed address (usually `http://localhost:5173`), enter your email, and
click the link it sends you.

## Deploying

Push to a private GitHub repo, then import it at [vercel.com](https://vercel.com).
Vercel auto-detects Vite — the only thing you must add manually is the two
environment variables from step 4, under **Environment Variables**. Every later
`git push` redeploys automatically.

## Project layout

```
src/
  App.jsx            session check, Log/History tabs, sign out
  Login.jsx          magic-link sign in
  BrewForm.jsx       the brew entry form; saves to Supabase + uploads the photo
  BrewHistory.jsx    past brews, newest first, with signed photo URLs
  supabaseClient.js  the shared Supabase connection
  tokens.js          colors, fonts, and the option lists (methods, flavors, …)
supabase/schema.sql  table, RLS policies, storage policies
docs/                PRD, system design, implementation guides, original mockup
```

## Status

**Milestones M1–M5 complete.** Structured logging form, Google and magic-link
auth, save to Postgres, photo upload, history list with filtering, edit and
delete, share-card generation, and setup carry-forward. Verified end to end in
production, including that a second account sees only its own brews.

Presets are handled without the separate `beans`/`equipment` tables the system
design anticipated: a new brew inherits method, equipment, beans and parameters
from your most recent one (tasting notes and photo are always cleared), and the
text fields autocomplete from distinct values across your history via
`suggestionsFrom` in [src/brew.js](src/brew.js). No migration, no joins, and it
works retroactively on brews already logged. Revisit the normalized tables only
if you need named setups that exist independently of any brew.

The card shows drink, method, beans, milk, rating, ratio, dose, temp and time.
Grind size and days-off-roast are deliberately left off it — still recorded on
every brew and shown in history, but they're personal repeatability data that
crowded the card without meaning much to anyone else.

The two ratios use **two different layouts**, because the geometry forces it. A
portrait photo has to be taller than the 1080px card width; the 1920px-tall
Story card has room for that above its text, but the 1350px-tall Post card does
not — even carrying nothing but the drink name, its tallest fitting photo is
1029px, still landscape. So the Post card puts the text *over* the photo on a
gradient scrim, while the Story card keeps the specimen layout below it.

Visually the Story card is a specimen sheet: the photo **bleeds to all four edges**
from the top, hands off to the paper panel across an amber hairline, and the
stats sit in a banded table opened by a dashed rule with hairlines between
columns.

The photo is a **4:5 portrait** frame — `PHOTO_ASPECT` in
[src/shareCard.js](src/shareCard.js), expressed as height ÷ width, so values
above 1 are portrait.

The photo gets the height it asks for until the content can't fit beneath it.
Then spacing compresses (gaps 36px → 16px, the rule-to-content step 56px → 28px)
and only once that's exhausted does the photo give way. So a tall photo squeezes
the information rather than colliding with it, and a fully-filled Story card
lands at about 1.16 rather than the full 1.25. Any paper left over is split
symmetrically above and below the content, so a short photo reads as deliberate
framing rather than a gap.

Share cards are painted on a canvas in [src/shareCard.js](src/shareCard.js) at
1080×1350 (Instagram 4:5) rather than via html-to-image as the system design
suggested — brew photos come from cross-origin signed URLs, which taint a canvas
and break `toBlob()`. Downloading the blob through the Supabase SDK avoids that,
and also lets us await `document.fonts.ready` so the card never renders in a
fallback typeface. On phones the card goes to the OS share sheet via the Web
Share API; elsewhere it downloads as a PNG.

Beyond the original docs, brews also record a **drink** (Iced Latte, Long Black,
Cappuccino) separately from the brewing **method** (Pourover, Espresso) — one
method makes many drinks. The drink is the headline in history and on the share
card, with the method dropping to the secondary line. It's a free-text field
suggested from `DRINKS` in [src/tokens.js](src/tokens.js) plus whatever you've
logged before, so it isn't a closed list.

Beans can be marked **Single Origin** or **Blend**, and the choice changes what
the form asks for. Single origin uses the flat `bean_name` / `origin` /
`process` columns. A blend uses `blend_components` — a `jsonb` array of up to
five beans, each with its own name, origin, process and percentage share, which
reads back as "Brazil 50% + Indonesia 50%" in history and on the card.

`bean_name` is the **roastery** and applies to the whole bag either way — a
blend is sold as one bag by one roaster. Only `origin` and `process` are
per-component, and a blend nulls those so the two representations can't hold
contradictory versions of the same beans. `jsonb` rather than a `brew_beans`
table because the app already fetches every row and filters client-side — a
relational table would add a join and an RLS policy without enabling any query
we can't do in memory.

The share card puts this on two lines under the drink: **"Espresso, Elephant
Grounds"** (method, roastery) then **"Blend · Brazil (50%), Aceh Gayo (50%)"** —
or **"Single Origin · Ethiopia"**. Each component shows its origin, falling back to
its lot name only when no origin was recorded.

Percentages are advisory: the form shows a running total and marks anything that
isn't 100%, but never blocks a save. Roast level and roast date stay on the brew
for both cases, since a blend is roasted as one bag.

The chips are deselectable and `bean_type` is nullable with no default, so a bag
you're unsure about stays unrecorded rather than being guessed at — which also
means brews logged before this existed aren't retroactively mislabelled.

Beans also carry a **roast date**, from which the app derives days-off-roast —
shown as `OFF ROAST` in history and on the share card. That's measured against
each brew's own `created_at` rather than today, so an old entry still reports how
fresh the beans were when you actually made it. See `daysOffRoast` in
[src/brew.js](src/brew.js); it compares local calendar days, because a roast date
printed on a bag has no timezone.

Milk-based drinks record an optional **milk brand** and **kind** (Greenfields ·
Fresh Milk), kept as two columns so each autocompletes independently. The milk
line is hidden entirely when both are empty, so an espresso isn't cluttered by
it.

Ratings are **coffee cups, out of five** — lucide's `Coffee` icon in the app, and
hand-drawn canvas paths in the share card (`drawCup` in
[src/shareCard.js](src/shareCard.js), since canvas can't use the React icon set
and an emoji would clash with the palette).

**Grind size** is a number plus a unit (`grind_size numeric`, `grind_unit text`)
rather than free text. Grinders use incompatible scales — clicks from zero, a
1–40 stepped dial, rotations-plus-clicks — so a bare number means nothing alone.
But grind is never compared *across* grinders; the only question is what you set
*your* grinder to, and within one grinder any consistent notation sorts
correctly. Keeping it numeric means it stays filterable and sortable, and
decimals cover micro-adjustment. The unit autocompletes and carries forward, so
in practice you set it once per grinder.

Brew time is **two integer boxes** (min / sec) rather than one `m:ss` text
field: typing a colon on a phone means switching keyboard layout and back, every
single brew. All the numeric fields carry `inputMode` so phones open a number pad
instead of the full keyboard. Seconds over 59 roll up on save, so 90 in the
seconds box records 1:30.

Method accepts **"Other"** with a free-text field. The real value is what gets
stored (`"Siphon"`, never the literal `"Other"`), so history filter chips and
share-card headlines read naturally.

## Installing to a phone

The app is a PWA: open it in the phone browser and use **Add to Home Screen**
(Share menu on iOS, the ⋮ menu on Android). It then runs full-screen with its
own icon and no browser chrome.

Icons are generated by `node scripts/make-icons.mjs`, which writes the PNGs in
[public/](public/) using a small built-in encoder rather than an image
dependency. The mark is the same cup geometry as `drawCup` in
[src/shareCard.js](src/shareCard.js). Re-run it only if the mark or palette
changes.

[public/sw.js](public/sw.js) caches the shell and the fingerprinted build assets
so the app opens instantly and survives a flaky connection. **It does not make
the app work offline** in any real sense — every brew lives in Supabase, so with
no connection you get the shell and an error rather than a browser error page.
Supabase requests are deliberately never cached: they're per-user and
auth-scoped, and a stale copy could outlive a sign-out. Real offline logging
would need a local write queue that syncs later.

## Not built yet

- **Equipment is write-only.** Brewer brand, model, grinder, process and roast
  level are recorded and searchable but never displayed back in history.
- **Nothing analyses the data.** The PRD's third goal — identify what produced
  your best results — has no view. Filtering finds a good brew; nothing shows
  what the good ones have in common.
- **Flavour tags are the fixed eight** from the mockup; the PRD's question about
  custom tags is still open.
- **Bean variety** (the cultivar half — Bourbon, Typica, SL28) is in the PRD's
  data model but not the schema.

Known limits: Supabase's built-in email sender is rate-limited to a few messages
per hour, so sign-in links can be slow to arrive for new users — configure your
own SMTP under Authentication → Emails before sharing widely. Anyone with the URL
can create an account (their data stays private to them); turn off signups under
Authentication → Sign In / Providers to close that off.
