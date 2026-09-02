-- Brew Log schema — run this in the Supabase dashboard under SQL Editor -> New query.
-- Safe to run in one go. See docs/brew-log-implementation-plan-detailed.md Part 1.

-- ---------------------------------------------------------------------------
-- 1. The brews table
-- ---------------------------------------------------------------------------

create table if not exists brews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null default auth.uid(),
  created_at    timestamptz not null default now(),
  drink         text,           -- what's in the cup: Iced Latte, Long Black…
  method        text,           -- how it was brewed: Pourover, Espresso…
  machine_brand text,
  machine_model text,
  grinder       text,
  bean_name     text,
  origin        text,
  process       text,
  roast_level   text,
  roast_date    date,           -- when the beans were roasted, optional
  milk_brand    text,           -- optional, milk drinks only
  milk_type     text,           -- Fresh Milk, Oat, Low Fat…
  dose_g        numeric,
  water_g       numeric,
  water_temp_c  numeric,
  brew_time_s   integer,
  flavor_tags   text[],
  rating        smallint,
  notes         text,
  photo_path    text
);

-- History is always read newest-first, scoped to one user.
create index if not exists brews_user_created_idx
  on brews (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Row-level security: a user can only ever touch their own rows
-- ---------------------------------------------------------------------------

alter table brews enable row level security;

create policy "Users can view their own brews"
on brews for select
using (auth.uid() = user_id);

create policy "Users can insert their own brews"
on brews for insert
with check (auth.uid() = user_id);

-- NOTE: `using` alone (as written in the implementation guides) only checks the
-- row as it exists BEFORE the update. Without the matching `with check`, an
-- update could reassign user_id to somebody else's id. Both clauses are needed.
create policy "Users can update their own brews"
on brews for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own brews"
on brews for delete
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Storage policies for the brew-photos bucket
-- ---------------------------------------------------------------------------
-- Create the bucket first in the dashboard: Storage -> New bucket, named
-- `brew-photos`, with "Public bucket" turned OFF. Then run this.
--
-- Photos live at {user_id}/{brew_id}.{ext}, so the first folder segment of the
-- object name is the owner's user id — that is what these policies check.

create policy "Users can upload their own brew photos"
on storage.objects for insert
with check (
  bucket_id = 'brew-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can view their own brew photos"
on storage.objects for select
using (
  bucket_id = 'brew-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Needed so deleting a brew can also remove its photo, rather than orphaning
-- the file in the bucket. If you set up before this existed, run
-- 002-photo-delete-policy.sql instead of re-running this whole file.
create policy "Users can delete their own brew photos"
on storage.objects for delete
using (
  bucket_id = 'brew-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
