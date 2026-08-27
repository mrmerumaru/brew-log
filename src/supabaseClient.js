import { createClient } from '@supabase/supabase-js'

// TODO: Securely load these values from an environment variable or secrets
// vault. Do not hardcode them here — they belong in .env.local locally, and in
// Vercel's Environment Variables settings for the deployed app.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loudly at startup rather than with a confusing network error later.
// This is the single most common setup mistake: Vite only reads .env.local on
// startup, so restart `npm run dev` after editing it.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Copy .env.example to .env.local, fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase ' +
      'project (Project Settings -> API), then restart the dev server.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
