# Brew Log Setup Guide — Detailed, No Experience Needed

This version assumes you've never coded or deployed anything before. Every tool and term is explained the first time it shows up. Go slowly, and do each step in order — later steps depend on earlier ones working.

**Roughly 2–3 hours total**, spread over however many sittings you want. Nothing here is timed.

---

## Before You Start: What You're Actually Building

Three pieces talk to each other:

1. **Supabase** — a website that stores your data (your brews) and your photos, for free, without you running your own server.
2. **Your React app** — the actual form/website you interact with (you already have the design for this).
3. **Vercel** — a website that takes your app's code and makes it available at a real web address, so you can open it from your phone.

You'll set these up in that order: storage first, then the app, then make it live.

---

## Part 0: Install the Tools You Need

### 0.1 Install Node.js

Node.js is a program that lets your computer run the same language (JavaScript) that your app is written in, before it's published to the web.

1. Go to [nodejs.org](https://nodejs.org).
2. Download the version marked **LTS** (this means "Long Term Support" — the stable one, not the newest/experimental one).
3. Run the installer, click through with default options.
4. To check it worked, open your computer's **terminal**:
   - **Mac:** press `Cmd + Space`, type `Terminal`, hit Enter.
   - **Windows:** press the Start key, type `Command Prompt`, hit Enter.
5. In the terminal window that opens, type this and press Enter:
   ```
   node -v
   ```
   You should see something like `v20.11.0`. If you see a version number, it worked. If you see "command not found," restart your computer and try again — sometimes it needs a restart to register.

The terminal is just a window where you type text commands instead of clicking things. You'll use it a handful of times in this guide — every command you need to type will be given to you exactly, in a gray box like the one above.

### 0.2 Create Your Accounts

Go to each site and sign up (free, and you can use "Sign in with GitHub" or Google if offered to skip creating new passwords):

- [supabase.com](https://supabase.com) — where your data lives
- [github.com](https://github.com) — where your code lives (like Google Drive, but for code)
- [vercel.com](https://vercel.com) — makes your app live on the internet (you can sign up using your new GitHub account, one click)

---

## Part 1: Set Up Supabase (Your Database + Photo Storage)

### 1.1 Create the project

1. Log into [supabase.com](https://supabase.com).
2. Click **New Project**.
3. Fill in:
   - **Name:** `brew-log`
   - **Database password:** click "generate a password," then **copy it somewhere safe** (a notes app is fine). You probably won't need it again, but it's better to have it.
   - **Region:** pick whichever is physically closest to you — it just makes things load slightly faster.
4. Click **Create new project** and wait about 2 minutes while it sets up. It's ready when the loading screen disappears and you see a dashboard.

### 1.2 Create the table that holds your brews

Think of a "table" like a spreadsheet — rows are your individual brews, columns are things like "method" or "rating."

1. On the left sidebar, click **SQL Editor**.
2. Click **New query**. This opens a blank text box — this is where you'll paste a command that creates your spreadsheet-like table.
3. Copy this whole block and paste it in:

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

4. Click the green **Run** button (or press `Cmd/Ctrl + Enter`).
5. You should see "Success. No rows returned" at the bottom. That means the table was created.
6. To confirm: click **Table Editor** on the left sidebar. You should now see a table called `brews` with all those column names as headers, currently empty. That emptiness is expected — you haven't saved any brews yet.

### 1.3 Lock the table down so only you can see your own data

Right now, technically, the table exists but isn't yet protected. This next step turns on a security rule so that later, even if other people use the app, nobody can see anyone else's brews.

1. Go back to **SQL Editor → New query**.
2. Paste and run this:

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

3. Click **Run**. You should again see a success message.

You don't need to fully understand this SQL — the short version is: "a person can only read or change rows that belong to them." This matters more once you're not the only user.

### 1.4 Create a place to store photos

1. On the left sidebar, click **Storage**.
2. Click **New bucket**. A "bucket" is just a named folder for files.
3. Name it `brew-photos`. Leave "Public bucket" **turned off** — you want photos private by default.
4. Click **Create bucket**.
5. Click into the new `brew-photos` bucket, go to its **Policies** tab, and click **New policy** (you may see a button like "For full customization" or "Create a policy from scratch" — pick that).
6. You'll paste in two policies. If Supabase gives you a form instead of a text box, look for a link like "switch to SQL editor" or just go back to **SQL Editor → New query** and run this instead:

```sql
create policy "Users can upload their own brew photos"
on storage.objects for insert
with check (bucket_id = 'brew-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own brew photos"
on storage.objects for select
using (bucket_id = 'brew-photos' and auth.uid()::text = (storage.foldername(name))[1]);
```

7. Click **Run**.

### 1.5 Copy your two "keys"

Your app needs two pieces of information to connect to this Supabase project — think of them like an address and a password for your app (not for you personally).

1. Click the **Settings** gear icon (bottom of left sidebar) → **API**.
2. You'll see:
   - **Project URL** — looks like `https://abcxyz.supabase.co`
   - **anon public** key — a long string of letters and numbers
3. Copy both into your notes app for now — you'll need them in Part 3.

**Checkpoint:** at this point, Supabase has a table for your brews, security rules protecting it, and a bucket for photos. Nothing is connected to an actual app yet — that's next.

---

## Part 2: Get the App Code Onto Your Computer

### 2.1 Create the project folder

1. Open your terminal (same as before).
2. Type each of these lines one at a time, pressing Enter after each:

```
npm create vite@latest brew-log -- --template react
```

This asks a program called Vite to create a new, empty React project in a folder called `brew-log`. It may ask you a couple of yes/no questions in the terminal — default answers are fine, just press Enter.

```
cd brew-log
```

`cd` means "change directory" — this moves your terminal *into* the new folder, so the next commands apply to it.

```
npm install
```

This downloads all the underlying code libraries your project depends on. It can take a minute or two and will print a lot of text — that's normal.

```
npm install @supabase/supabase-js
```

This adds the specific library that lets your app talk to Supabase.

### 2.2 Open the project in an editor

You'll want a proper code editor rather than editing files blind in the terminal.

1. Download **VS Code** (free) from [code.visualstudio.com](https://code.visualstudio.com) if you don't have it.
2. Open VS Code → **File → Open Folder** → select the `brew-log` folder you just created.
3. On the left, you'll see a file list — this is your project.

### 2.3 Add your brew form

1. In VS Code's file list, right-click the `src` folder → **New File** → name it `BrewForm.jsx`.
2. Paste in the mockup code from earlier in this project (the interactive form component) and save (`Cmd/Ctrl + S`).

---

## Part 3: Connect the App to Supabase

### 3.1 Store your keys safely

1. In VS Code, right-click the top-level `brew-log` folder → **New File** → name it exactly `.env.local` (the dot at the start matters).
2. Paste this in, replacing the placeholders with the two values you copied in Step 1.5:

```
VITE_SUPABASE_URL=paste-your-project-url-here
VITE_SUPABASE_ANON_KEY=paste-your-anon-key-here
```

3. Save the file.

This file holds your project's "address and password." It should **never** be shared or uploaded publicly — the next step makes sure of that automatically.

4. Open the file named `.gitignore` in the project (it already exists). Check that a line reads `.env.local` — if not, add it on its own line and save. This tells the system that later saves/uploads your code, "don't include this file."

### 3.2 Create the connection file

1. In `src`, create a new file called `supabaseClient.js`.
2. Paste in:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

3. Save.

This file reads the two values from `.env.local` and sets up a reusable connection object called `supabase`, which the rest of your app will import whenever it needs to save or read data.

### 3.3 Add a simple login

Since brews are tied to a specific user, people need to log in first — even if that's just you for now. We'll use "magic link" login: you type your email, get a link, click it, you're in. No password to remember.

1. Create `src/Login.jsx`:

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

2. Open `src/App.jsx`, delete everything in it, and replace with:

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

This means: "if someone's logged in, show them the brew form; if not, show the login screen."

### 3.4 Try it out locally

1. In the terminal (make sure you're still inside the `brew-log` folder), type:

```
npm run dev
```

2. It will print a local web address, usually `http://localhost:5173`. Open that in your browser.
3. You should see the login screen. Type your email, click send, check your inbox, click the link. You should land back on the app, now seeing the brew form.

If this works, your app and Supabase are successfully talking to each other. Leave this terminal window running while you keep working — it auto-refreshes the browser as you edit code.

---

## Part 4: Make "Save" Actually Save

Right now the mockup's Save button just shows a checkmark visually — it doesn't store anything yet.

1. Open `BrewForm.jsx`, and near the top, add:

```javascript
import { supabase } from './supabaseClient'
```

2. Find the function connected to your Save button, and replace its contents with:

```javascript
const handleSave = async () => {
  const { data: { user } } = await supabase.auth.getUser()

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

  if (photoFile) {
    const path = `${user.id}/${brew.id}.jpg`
    await supabase.storage.from('brew-photos').upload(path, photoFile)
    await supabase.from('brews').update({ photo_path: path }).eq('id', brew.id)
  }

  setSaved(true)
}
```

3. Make sure your Save button calls `handleSave` — e.g. `<button onClick={handleSave}>Save Brew</button>`.
4. You'll also need to keep the actual photo file (not just the preview) in state. Wherever your form currently does something like `setPhoto(URL.createObjectURL(file))` after picking a photo, add a second line: `setPhotoFile(file)` — and add `const [photoFile, setPhotoFile] = useState(null)` near your other `useState` lines.

5. Test it: fill out the form in your browser, click Save. Then go back to Supabase → **Table Editor → brews** and refresh — you should see your new row.

**If nothing shows up:** open your browser's developer console (`Cmd/Ctrl + Option/Shift + I`, then click "Console") and look for a red error message — copy it and troubleshoot from there, or check the Gotchas section at the end.

---

## Part 5: See Your Past Brews

1. Create `src/BrewHistory.jsx`:

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

2. For now, add `<BrewHistory />` somewhere in `App.jsx` below `<BrewForm />` so you can see it. (You'll likely want to design this properly later — this is just to confirm things work.)

---

## Part 6: Put It Live on the Internet

### 6.1 Upload your code to GitHub

1. In the terminal, still inside `brew-log`, type each line separately:

```
git init
git add .
git commit -m "first version of brew log"
```

`git` is a tool that tracks changes to your code. This creates a "save point" of everything so far.

2. Go to [github.com](https://github.com), click **New repository**, name it `brew-log`, leave it **Private**, click **Create repository**.
3. GitHub will show you some commands — copy the ones under "…or push an existing repository from the command line," they'll look like:

```
git remote add origin https://github.com/your-username/brew-log.git
git branch -M main
git push -u origin main
```

4. Run those in your terminal. It may ask you to log into GitHub — follow the prompts.

### 6.2 Deploy with Vercel

1. Go to [vercel.com](https://vercel.com), click **Add New → Project**.
2. Find and select your `brew-log` GitHub repo, click **Import**.
3. Before clicking deploy, expand **Environment Variables** and add the same two values from your `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. Wait a minute or two.
5. You'll get a live web address like `brew-log-yourname.vercel.app` — open it on your phone. This is now a real, working app.

Every time you make changes later and run `git add .`, `git commit -m "..."`, `git push`, Vercel automatically updates the live version within a minute or two.

---

## Troubleshooting (Read This When Something Breaks)

| Problem | Likely cause |
|---|---|
| "command not found" in terminal | The tool isn't installed, or you need to restart your terminal/computer after installing |
| Nothing happens when you click Save | Open the browser console (see Part 4) and read the red error text |
| Supabase table stays empty after saving | You're not actually logged in — check `supabase.auth.getUser()` isn't returning null |
| Photo saves but won't display later | Check the Storage policy's folder-matching logic in Step 1.4 |
| Env variables seem ignored | Restart `npm run dev` after editing `.env.local` — it only reads that file on startup |
| Vercel deploy fails | Almost always missing environment variables — recheck Step 6.2.3 |

---

## What You'll Have After This

- A real, working web app only you (for now) can log into
- Every brew saved permanently in a real database, not a spreadsheet
- Photos stored and attached to each brew
- A live web address you can open from your phone at the counter

Next natural step once this feels solid: the share-card generation (M3 from the system design), and eventually presets so you're not re-typing the same beans/equipment every time.
