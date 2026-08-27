# Implementation Plan: Brew Log Setup Guide

**Companion to:** Brew Log PRD + System Design (v1)
**Goal of this doc:** Get from zero to a working, deployed app — Supabase backend wired to the React form you already have.

---

## Prerequisites

- A GitHub account (for deploying via Vercel)
- Node.js installed on your machine ([nodejs.org](https://nodejs.org) — LTS version)
- A Supabase account ([supabase.com](https://supabase.com) — free tier)
- A Vercel account ([vercel.com](https://vercel.com) — free tier, can sign in with GitHub)

---

## Step 1: Create the Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**.
2. Name it `brew-log`, set a database password (save it somewhere — you likely won't need it day-to-day since the client SDK handles auth), pick the region closest to you.
3. Wait ~2 minutes for provisioning.
4. Once ready, go to **Project Settings → API**. You'll need two values later:
   - **Project URL**
   - **anon public key**

---

## Step 2: Create the Database Table

In Supabase, go to **SQL Editor → New Query**, paste and run:

```sql
create table brews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  created_at timestamptz not null default now(),
  method text,
  machine_brand text,
  machine_model text,
  grinder text,
  bean_name text,
  origin text,
  process text,
  roast_level text,
  dose_g numeric,
  water_g numeric,
  water_temp_c numeric,
  brew_time_s integer,
  flavor_tags text[],
  rating smallint,
  notes text,
  photo_path text
);
```

---

## Step 3: Turn On Row-Level Security

Still in SQL Editor:

```sql
alter table brews enable row level security;

create policy "Users can view their own brews"
on brews for select
using (auth.uid() = user_id);

create policy "Users can insert their own brews"
on brews for insert
with check (auth.uid() = user_id);

create policy "Users can update their own brews"
on brews for update
using (auth.uid() = user_id);

create policy "Users can delete their own brews"
on brews for delete
using (auth.uid() = user_id);
```

This means: even though it's just you today, the database itself enforces that a user can only ever see or touch their own rows.

---

## Step 4: Create a Storage Bucket for Photos

1. In Supabase, go to **Storage → New Bucket**.
2. Name it `brew-photos`. Leave it **private** (not public) — access will go through policies, same as the table.
3. Go to the bucket's **Policies** tab and add:

```sql
create policy "Users can upload their own brew photos"
on storage.objects for insert
with check (bucket_id = 'brew-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own brew photos"
on storage.objects for select
using (bucket_id = 'brew-photos' and auth.uid()::text = (storage.foldername(name))[1]);
```

This assumes photos are stored at a path like `{user_id}/{brew_id}.jpg` — the policy checks that the folder name matches the logged-in user's id.

---

## Step 5: Set Up the React Project Locally

If you haven't already turned the mockup into a real project:

```bash
npm create vite@latest brew-log -- --template react
cd brew-log
npm install
npm install @supabase/supabase-js
```

Copy your existing mockup component into `src/BrewForm.jsx`.

---

## Step 6: Connect to Supabase

Create `src/supabaseClient.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Create a `.env.local` file in the project root (never commit this file):

```
VITE_SUPABASE_URL=your-project-url-here
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Add `.env.local` to `.gitignore` if it isn't already there.

---

## Step 7: Add Auth (Magic Link)

A minimal login component, `src/Login.jsx`:

```javascript
import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (!error) setSent(true)
  }

  if (sent) return <p>Check your email for the login link.</p>

  return (
    <div>
      <input
        type="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={handleLogin}>Send magic link</button>
    </div>
  )
}
```

In `App.jsx`, check for a session and show either `Login` or the main app:

```javascript
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import BrewForm from './BrewForm'

export default function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  return session ? <BrewForm /> : <Login />
}
```

---

## Step 8: Wire the Mockup's Save Button to Supabase

Inside `BrewForm.jsx`, replace the placeholder `setSaved(true)` logic with an actual insert + photo upload:

```javascript
import { supabase } from './supabaseClient'

const handleSave = async () => {
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Insert the brew row first to get an id
  const { data: brew, error } = await supabase
    .from('brews')
    .insert({
      user_id: user.id,
      method,
      machine_brand: machineBrand,
      machine_model: machineModel,
      grinder,
      bean_name: beanName,
      origin,
      process,
      roast_level: roast,
      dose_g: parseFloat(dose),
      water_g: parseFloat(water),
      water_temp_c: parseFloat(temp),
      flavor_tags: flavors,
      rating,
      notes,
    })
    .select()
    .single()

  if (error) {
    console.error(error)
    return
  }

  // 2. If a photo was picked, upload it and save the path
  if (photoFile) {
    const path = `${user.id}/${brew.id}.jpg`
    await supabase.storage.from('brew-photos').upload(path, photoFile)
    await supabase.from('brews').update({ photo_path: path }).eq('id', brew.id)
  }

  setSaved(true)
}
```

Note: this assumes you keep the actual `File` object (not just a preview URL) in state when the user picks a photo — e.g. `setPhotoFile(file)` alongside your existing `setPhoto(URL.createObjectURL(file))`.

---

## Step 9: Build a Basic Brew History View

A minimal `src/BrewHistory.jsx` to confirm everything's working end-to-end:

```javascript
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function BrewHistory() {
  const [brews, setBrews] = useState([])

  useEffect(() => {
    supabase
      .from('brews')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setBrews(data ?? []))
  }, [])

  return (
    <ul>
      {brews.map((b) => (
        <li key={b.id}>
          {b.method} — {b.bean_name} — {b.rating}★
        </li>
      ))}
    </ul>
  )
}
```

---

## Step 10: Deploy to Vercel

1. Push the project to a new GitHub repo.
2. In Vercel, **New Project → Import** your repo.
3. Under **Environment Variables**, add the same two values from your `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Deploy. Vercel gives you a live URL immediately, and redeploys automatically on every push to `main`.

---

## Checklist: Mapping Back to the System Design Milestones

- [ ] **M1** — Supabase project + table + RLS set up (Steps 1–4); form saves a brew (Steps 5–8)
- [ ] **M2** — Photo upload working end-to-end (Step 8, storage portion)
- [ ] Basic history view to confirm data round-trips correctly (Step 9)
- [ ] Deployed and usable from your phone browser at the counter (Step 10)
- [ ] **M3** (later) — Share card generation, once the core loop feels solid

---

## Common Gotchas

- **RLS blocks everything and you don't know why:** almost always means `user_id` wasn't set correctly on insert, or you're not logged in yet when testing. Check `supabase.auth.getUser()` returns a user first.
- **Photo upload succeeds but you can't view it later:** double check the storage policy's folder-matching logic — the path must start with the user's id as the first folder segment.
- **Env vars not picked up:** Vite requires them prefixed with `VITE_`, and you must restart the dev server after adding/changing `.env.local`.
