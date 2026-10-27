-- Migration 010 — grinder micro-adjustment.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- schema.sql now includes these columns for fresh setups.
--
-- The fine-tune dial on the side of an espresso grinder: a small offset
-- from the base grind setting. Some grinders have one, most don't, which is
-- why both columns are nullable with no default — "not recorded" stays
-- expressible rather than being silently recorded as zero.
--
-- The unit is the grinder's own scale. It defaults to "clicks" in the form
-- because that's the common case, but it's free text so a grinder that
-- counts in microns or rotations works too. Kept as a separate column from
-- grind_unit rather than reusing it: the two are different scales, and a
-- grinder can have both (base setting in clicks, micro-adjustment in
-- microns).

alter table brews add column if not exists micro_adjustment numeric;
alter table brews add column if not exists micro_adjustment_unit text;
