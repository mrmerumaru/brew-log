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

Two environments, both on Vercel, both pointing at the **same Supabase project**:

| Branch | URL | Who uses it |
|---|---|---|
| `main` | https://brew-log-xi.vercel.app | the people you've shared it with |
| `dev` | https://brew-log-git-dev-brew-log1.vercel.app | you, while building |

Work on `dev`, test at the dev URL, then release:

```bash
git checkout main && git merge dev && git push
```

The dev build installs as "Brew Log dev" with the inverted logo, and shows an
amber **DEV** chip beside Sign out. It appears unless
`VITE_APP_ENV=production`, which only the Production environment sets — so a
missing variable shows a badge that shouldn't be there rather than hiding one
that should. Vite inlines `VITE_*` at build time, so changing it requires a
redeploy, not just a save.

Use the `-git-dev-` alias above, never a deployment URL like
`brew-6yryu0gow-…` — those carry a build hash and change on every push, so
anything registered against one breaks at the next deploy. Both the alias and
production need to be listed in **Supabase → Authentication → URL
Configuration** and as an authorized JavaScript origin in Google Cloud; the
OAuth *redirect* URI points at Supabase and never changes.

Preview deployments sit behind Vercel Authentication, so the dev URL redirects
to a Vercel login unless you're signed in — including on a phone. Turn it off
under **Settings → Deployment Protection** if you want someone else to test a
branch before release.

### What the shared database means

A schema change hits the live app the moment the migration runs, so migrations
stay **additive** — every one so far is `add column if not exists`, which
production safely ignores until its code knows about it. Test brews are already
invisible to other people through RLS, so the shared database costs nothing
there. The day a `drop` or a rename is genuinely needed, split dev onto its own
Supabase project first.

### Interaction and type

Hover, focus and pressed states live in [src/index.css](src/index.css) as a
handful of `bl-*` classes rather than inline styles, because inline styles
can't express a pseudo-class. `applyTokens` in
[src/tokens.js](src/tokens.js) publishes the palette as CSS custom properties
at startup, so those rules use the same hex values as the canvas share card
instead of a second copy that would drift.

Focus deserves a note: every input had `outline-none` with nothing in its
place, so keyboard users got no indication of where they were. Text fields now
thicken their underline on focus — via `box-shadow`, not `border-width`, which
would shift the text by a pixel — and buttons draw a green ring on
`:focus-visible` only, so a mouse click doesn't leave one behind.

The type scale is four sizes (10/12/14/16). It was seven between 9px and 15px,
which is noise rather than hierarchy; the scale is documented at the top of
tokens.js.

The mark in the header and on the login screen is the real app icon, so it
matches the home screen and differs between the two installs like everything
else about them.

### Editorial detailing

Four print devices, on top of the interaction work above:

- **Lettered section bands.** Each section opens with a ruled band carrying a
  mono letter, A–G in the order you page through the form — not matching any
  other numbering, so they read as a sequence. The mark turns amber once the
  section holds a value.
- **Paper tooth.** `.bl-paper` lays a generated `feTurbulence` grain over the
  flat fills at 4% opacity, so surfaces read as stock rather than as a colour
  swatch. Generated rather than an image: it's finer than a JPEG holds at this
  size and costs no request. It sits in the background layer, so photos and the
  share-card canvas paint on top untouched.
- **An amber rule under the card header**, echoing the share card's
  photo-to-paper handoff so the app and its output share a device.
- **Amber means "a recorded measurement"** — ratios, ratings, the running blend
  and pour totals, and the values in history. Green stays strictly for things
  you can act on. Previously amber appeared only on ratings, so it read as
  decoration rather than as a signal.

## Project layout

```
src/
  main.jsx           entry point; mounts the app and registers the service worker
  App.jsx            session check, Log/History tabs, DEV badge, sign out
  ErrorBoundary.jsx  catches render errors so a crash isn't a blank page
  Login.jsx          Google sign in
  BrewForm.jsx       the brew entry form; saves to Supabase + uploads the photo
  BrewHistory.jsx    past brews, newest first, with signed photo URLs
  ShareSheet.jsx     share dialog: aspect choice, live preview, pan and zoom
  shareCard.js       paints the card on a canvas and hands it to the OS
  brew.js            pure helpers — times, ratios, blends, pours, suggestions
  Insights.jsx       what the log adds up to; reuses App's fetch, queries nothing
  stats.js           the arithmetic behind Insights, pure and Node-testable
  image.js           resizes photos before upload, honouring EXIF orientation
  supabaseClient.js  the shared Supabase connection
  tokens.js          colors, fonts, and the option lists (methods, flavors, …)
  index.css          Tailwind import, safe-area insets for the installed app
public/              PWA manifest, service worker, generated icons
scripts/             make-icons.mjs, which builds both icon sets from image/
supabase/            schema.sql plus the numbered migrations, applied in order
docs/                PRD, system design, implementation guides, original mockup
image/               logo.jpeg (production) and logo-dev.jpeg, the icon sources
```

## Status

**Milestones M1–M5 complete.** Structured logging form, Google sign-in, save to
Postgres, photo upload, history list with filtering, edit and delete, share-card
generation, and setup carry-forward. Verified end to end in production, including
that a second account sees only its own brews.

Sign-in is **Google only**. Magic links were removed from the UI once they
stopped being used — Supabase's built-in email sender allows only a couple of
messages an hour, which made them unreliable for anyone but the first user. Email
OTP is still enabled on the Supabase project, so restoring a fallback is a UI
change with no configuration to redo.

The Google OAuth consent screen is deliberately left in **Testing** mode, which
admits up to 100 accounts added under **Audience → Test users** in Google Cloud
Console. Adding someone there is the only step needed to let them in.

Publishing was considered and rejected: it requires a homepage URL, a privacy
policy URL, and an authorized domain, and Google reduces
`brew-log-xi.vercel.app` to the registrable domain `vercel.app` — which isn't
ours and can't be verified in Search Console. Publishing therefore means buying
a custom domain, which isn't worth it while the audience is a handful of people.
Revisit if this ever needs to be open to anyone with the link.

Testing mode has two consequences: new users click through an "unverified app"
notice once, and Google expires Testing refresh tokens after 7 days. The second
matters little here because Supabase issues its own session after sign-in, so
the practical effect is occasionally signing in again.

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

Both ratios use one layout: the **photo fills the whole card** and the text sits
over a gradient scrim at the bottom in light type. That's what makes a portrait
photo possible at 4:5 — a portrait photo has to be taller than the 1080px card
width, and the 1350px-tall Post card has no room for that plus text beneath it.
Even carrying nothing but the drink name, the tallest photo that would fit below
the text is 1029px, still landscape.

The scrim fades in 180px above the headline and reaches 94% at the bottom edge,
leaving the photo completely clear across the top 57–64% of a Story card and 49%
of a Post card. Stats run inline (`RATIO 1:16.1 · DOSE 18g · …`) rather than in a
bordered table, which would fight the photograph.

**Flavour tags appear on the Story card only** — `flavorTags` per ratio in
`CARD_RATIOS`. The Story card can carry two chip rows and still leave 57% of the
photo clear; on the much shorter Post card the same rows would eat another 120px
of a smaller image. Over a photo they're translucent white pills rather than the
app's pale-green ones, since a light solid fill flattens into a row of blank
shapes against a bright background.

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

**Pourover brews record a pour schedule.** Choosing the Pourover method reveals
a Pours section inside Parameters: each pour has a time and its own water
amount, Pour 1 is always present and can't be removed, and up to eight can be
added. Leaving Pour 1 empty shows a warning but never blocks a save — a partial
log beats an abandoned one, and nothing else in the app blocks saving either.
Stored as `pours` jsonb — see [supabase/009-add-pours.sql](supabase/009-add-pours.sql).

Each pour stores only the water *it* adds; the running total is derived on read
(`pourTotals` in [src/brew.js](src/brew.js)) rather than stored, so editing pour
2 can't leave a stale total on pour 3. The section header compares the pour total
against the main Water field and flags a mismatch, but never blocks a save.
Pours appear in history and deliberately **not** on the share card.

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

Icons are generated by `node scripts/make-icons.mjs` from the logos in
[image/](image/), writing the PNGs in [public/](public/). Re-run it only when a
logo changes.

**Two sets**: production uses the gold-on-black mark and installs as "Brew Log";
dev uses the inverted black-on-gold one and installs as "Brew Log dev", so the
two are distinguishable on a phone home screen. Both sets are committed and the
build picks between them — `environmentIcons` in
[vite.config.js](vite.config.js) rewrites the manifest and icon links in
index.html unless `VITE_APP_ENV=production`. They can't be generated during the
build, because `sips` is macOS-only and Vercel builds on Linux.

The source is a landscape JPEG with the dark badge sitting in white padding, so
the script crops the largest square centred on the artwork that contains no
white pixel, then pads back out with the badge's flat interior colour. Both
numbers are measured from the source rather than eyeballed: cropping any wider
catches the badge's rounded corners and pulls white into the icon corners, and
the outermost row carries a highlight that shows as a seam against flat padding.
The rounded corners are dropped on purpose — iOS masks the apple-touch-icon and
Android masks the maskable one, so keeping them would round an already-rounded
shape. It uses macOS `sips` rather than an image dependency; the PNGs are
committed, so it only has to run on a Mac.

[public/sw.js](public/sw.js) caches the shell and the fingerprinted build assets
so the app opens instantly and survives a flaky connection. **It does not make
the app work offline** in any real sense — every brew lives in Supabase, so with
no connection you get the shell and an error rather than a browser error page.
Supabase requests are deliberately never cached: they're per-user and
auth-scoped, and a stale copy could outlive a sign-out. Real offline logging
would need a local write queue that syncs later.

[src/ErrorBoundary.jsx](src/ErrorBoundary.jsx) wraps the app in `main.jsx`. A
thrown render error otherwise unmounts the whole tree and leaves a blank white
page with nothing on screen to explain it — which is what a `const` read before
its declaration in `BrewForm` produced, and it took a revert to isolate. The
boundary shows the error name, message and component stack instead. Note it
catches render, lifecycle and constructor errors only; event handlers and async
callbacks still need their own try/catch, which is why `handleSave` and the
share flow have theirs.

Photos are **resized before upload** by [src/image.js](src/image.js) — 2000px
longest edge, JPEG quality 0.82, landing around 400 KB instead of the 3–5 MB a
phone produces. That is the difference between roughly 250 and 2,400 photos in
Supabase's free 1 GB tier, and it was the system design's open question about
image compression.

Two details that matter more than they look. The decode passes
`imageOrientation: "from-image"`, because re-encoding through a canvas drops the
EXIF rotation flag and every portrait photo would otherwise be stored sideways;
the `<img>` fallback is used in preference to a plain `createImageBitmap` call
for the same reason. And if anything fails — an undecodable HEIC, a failed
encode, or a result no smaller than the input — the original file is uploaded
untouched, because losing a photo is worse than storing a large one. The stored
extension follows what was actually encoded, so a resized PNG is saved as
`.jpg` rather than mislabelled.

Photos uploaded before this existed are still full size; re-saving those brews
with the photo re-picked is the only way to shrink them.

### Insights

The third tab answers the PRD's third goal — what produced your best results.
It contrasts the parameters of brews rated 4★ and up against the rest, ranks
methods, beans and grinders by average rating, and lists the cups worth
repeating.

The guard rails matter more than the arithmetic, because numbers presented as
insight get believed. A group under three brews is dropped rather than shown,
since a single 5★ brew would otherwise top every table forever. Every figure
carries the count behind it. And grind size is only compared when one grinder
is in play — 18 on a Comandante and 18 on a 1Zpresso aren't the same grind, so
mixing them would invent a finding. `stats.js` is pure and runs under plain
Node, which is how those rules are tested.

It adds no query: `rating` and `flavor_tags` joined the fetch App already made
for carry-forward and autocomplete.

## Not built yet

- **Equipment is write-only.** Brewer brand, model, grinder, process and roast
  level are recorded and searchable but never displayed back in history.
- **Flavour tags are the fixed eight** from the mockup; the PRD's question about
  custom tags is still open.
- **Bean variety** (the cultivar half — Bourbon, Typica, SL28) is in the PRD's
  data model but not the schema.

Known limits: Supabase's built-in email sender is rate-limited to a few messages
per hour, so sign-in links can be slow to arrive for new users — configure your
own SMTP under Authentication → Emails before sharing widely. Anyone with the URL
can create an account (their data stays private to them); turn off signups under
Authentication → Sign In / Providers to close that off.
