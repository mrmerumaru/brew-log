# System Design: Brew Log

**Companion to:** Brew Log PRD (v1)
**Status:** Draft v1
**Last updated:** August 21, 2026

---

## 1. Goals of This Document

Translate the PRD into a concrete technical architecture that's realistic for a solo, non-professional-developer build — favoring managed services over infrastructure you have to run yourself, while leaving a clear path to a public v2 without a rewrite.

## 2. Recommended Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React (Vite) | Matches the mockup you already have; no server-rendering needed for v1 |
| Backend | Supabase | One managed service gives you Postgres DB, Auth, and file storage together — minimal backend code to write or maintain |
| Database | Postgres (via Supabase) | Structured brew data with relationships (brews → beans → equipment) fits relational, not NoSQL |
| Photo storage | Supabase Storage | Same platform as the DB, so one dashboard, one bill, one auth system |
| Hosting (frontend) | Vercel (free tier) | Deploys straight from a GitHub repo, zero server management |
| Auth | Supabase Auth (email/password or magic link) | Even for solo use, having auth from day one avoids a painful migration if you open it up publicly later |

This is intentionally a "no custom backend server" architecture: your React app talks directly to Supabase using its client library, secured by row-level security rules rather than your own API. That's the part that keeps this manageable for someone still learning app development — there's no server to deploy, patch, or scale yourself.

## 3. Architecture Overview

```
┌─────────────────────┐
│   Browser (React)    │
│   Brew Log web app    │
└──────────┬───────────┘
           │  HTTPS (Supabase client SDK)
           ▼
┌─────────────────────────────────────┐
│              Supabase                │
│  ┌───────────┐  ┌────────────────┐   │
│  │  Auth      │  │  Postgres DB   │   │
│  │ (sessions) │  │ (brews, beans, │   │
│  │            │  │  equipment)    │   │
│  └───────────┘  └────────────────┘   │
│  ┌────────────────────────────────┐  │
│  │  Storage (brew photos, bucket) │  │
│  └────────────────────────────────┘  │
└─────────────────────────────────────┘
           ▲
           │ deploys from GitHub
┌──────────┴───────────┐
│   Vercel (hosting)    │
└───────────────────────┘
```

There is no custom backend server in v1. The React app is a "thin client" that reads and writes directly to Supabase's Postgres tables and Storage bucket, with Supabase enforcing who can access what.

## 4. Data Model (Postgres schema)

Building directly on the PRD's data model, normalized into tables so beans/equipment can be reused across brews later without re-typing them:

```
brews
─────
id            uuid (pk)
user_id       uuid (fk → auth.users)
created_at    timestamptz
method        text            -- Pourover, Moka Pot, etc.
machine_brand text
machine_model text
grinder       text
bean_name     text
origin        text
process       text            -- Washed, Natural, Honey, Anaerobic
roast_level   text            -- Light, Medium, Dark
dose_g        numeric
water_g       numeric
water_temp_c  numeric
brew_time_s   integer
flavor_tags   text[]          -- e.g. {Fruity, Nutty}
rating        smallint        -- 1–5
notes         text
photo_path    text            -- path in Storage bucket, nullable
```

For v1, equipment/beans stay as plain text fields on the `brews` table (matching your mockup) rather than separate reusable tables — simpler to build, and the PRD already flags "presets" as an open question for a later phase. If/when presets are added, `beans` and `equipment` would become their own tables referenced by foreign key.

## 5. Auth & Access Control

- Supabase Auth handles sign-in (email/password or magic link — magic link is simplest since there's no password to manage).
- Postgres **Row-Level Security (RLS)** is turned on for the `brews` table, with a policy like "a user can only read/write rows where `user_id` = their own auth id."
- Practically, this means: even though it's just you today, the data is already scoped per-user. If you invite others later, their brews are automatically private to them — no extra work needed.

## 6. Photo Storage Flow

1. User selects/takes a photo in the browser.
2. React app uploads it directly to a Supabase Storage bucket (e.g. `brew-photos/{user_id}/{brew_id}.jpg`) using the Supabase client SDK.
3. Supabase returns a path/URL, which gets saved in the `brews.photo_path` column.
4. When viewing brew history, the app fetches the photo URL from Storage to display it.

Storage access is also governed by a policy so users can only upload to and read their own folder.

## 7. Share Card Generation

Two options, from simplest to most flexible:

- **Client-side (recommended for v1):** Use a library like `html-to-image` or `dom-to-image` to render a styled DOM element (photo + method + beans + rating) as a downloadable/shareable PNG, entirely in the browser. No server involved.
- **Server-side (later, if you want more control over design/branding):** A small serverless function (e.g. a Vercel Edge Function) that composites the image server-side. Not needed for v1.

## 8. Non-Functional Considerations

- **Cost:** Supabase and Vercel free tiers comfortably cover solo use and early public use (Supabase free tier: 500MB DB, 1GB storage — plenty for text + compressed cup photos). Revisit pricing if/when it goes public.
- **Offline use:** Not handled in v1 — brewing usually happens at home on wifi, so this is a reasonable v1 cut. Worth revisiting for the mobile phase (kitchens/counters aren't always near reliable wifi).
- **Data portability:** Because it's plain Postgres under the hood, exporting all your data later (e.g. to move off Supabase) is a standard SQL export — not locked in.
- **Security:** RLS policies are the main safeguard; no custom auth/session code to get wrong.

## 9. Path to Mobile (later phase)

Because there's no custom backend to rebuild, moving to mobile later is mainly a frontend decision:
- **Option A:** React Native (or Expo), reusing the same Supabase project and schema as-is.
- **Option B:** Turn the web app into a installable PWA (Progressive Web App) first — much less work than a native app, and gets you home-screen install + camera access with the existing React codebase.

Recommendation: start with PWA once the web app is solid, and only move to a full native app if PWA limitations (e.g. background reminders, deeper camera control) actually become a problem.

## 10. What This Design Deliberately Avoids (for now)

- No custom backend/API server — reduces what you have to learn and operate as a solo, non-professional developer.
- No AI recommendation engine or social feed infra — matches the PRD's non-goals.
- No separate "beans"/"equipment" tables yet — deferred until presets are actually needed.

## 11. Open Questions

- Magic link vs. password auth — magic link is simpler but depends on email deliverability; worth testing before committing.
- Image compression strategy for photos (client-side resize before upload, to stay well within storage limits as brew count grows).
- At what point does moving off free tiers (Supabase/Vercel) become necessary — worth revisiting once/if this goes public.
