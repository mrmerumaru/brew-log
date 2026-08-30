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

**Milestones M1–M4 complete.** Structured logging form, Google and magic-link
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

Share cards are painted on a canvas in [src/shareCard.js](src/shareCard.js) at
1080×1350 (Instagram 4:5) rather than via html-to-image as the system design
suggested — brew photos come from cross-origin signed URLs, which taint a canvas
and break `toBlob()`. Downloading the blob through the Supabase SDK avoids that,
and also lets us await `document.fonts.ready` so the card never renders in a
fallback typeface. On phones the card goes to the OS share sheet via the Web
Share API; elsewhere it downloads as a PNG.

Not built yet: equipment/bean presets and history filtering (M4). Grind size,
bean variety, and roast date appear in the PRD's data model but aren't in the
schema or the form yet.

Known limits: Supabase's built-in email sender is rate-limited to a few messages
per hour, so sign-in links can be slow to arrive for new users — configure your
own SMTP under Authentication → Emails before sharing widely. Anyone with the URL
can create an account (their data stays private to them); turn off signups under
Authentication → Sign In / Providers to close that off.
