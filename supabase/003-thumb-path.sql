-- Brew Log schema delta 003 — thumbnails.
--
-- History renders every photo at 56-72px; serving the full-size image at that
-- scale is what burns Supabase's free-tier 5 GB egress (each History load
-- pulls ~30 full-resolution JPEGs at ~400 KB each). Storing a 256px thumbnail
-- alongside the original cuts the per-photo egress by ~10x without changing
-- anything users see.
--
-- Safe to re-run. New column is nullable so existing rows are unaffected;
-- the app falls back to the original photo_path when thumb_path is null.

alter table brews
  add column if not exists thumb_path text;

-- A second private bucket. The RLS policies below mirror the brew-photos
-- bucket so a user can only ever touch their own thumbnails.
--
-- Create the bucket first in the dashboard: Storage -> New bucket, named
-- `brew-thumbs`, with "Public bucket" turned OFF. Then run this file.

create policy "Users can upload their own brew thumbs"
on storage.objects for insert
with check (
  bucket_id = 'brew-thumbs'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can view their own brew thumbs"
on storage.objects for select
using (
  bucket_id = 'brew-thumbs'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own brew thumbs"
on storage.objects for delete
using (
  bucket_id = 'brew-thumbs'
  and auth.uid()::text = (storage.foldername(name))[1]
);