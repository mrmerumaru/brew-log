-- Migration 002 — allow deleting your own brew photos.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- Only needed if you already ran schema.sql before the delete feature was
-- added; schema.sql now includes this policy for fresh setups.
--
-- Why it's needed: the `brews` table already had a delete policy, but
-- storage.objects only had insert and select. Without this, removing a brew
-- would delete the row and leave its photo orphaned in the bucket, consuming
-- storage quota with nothing referencing it.

create policy "Users can delete their own brew photos"
on storage.objects for delete
using (
  bucket_id = 'brew-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
