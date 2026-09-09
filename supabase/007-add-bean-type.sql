-- Migration 007 — single origin or blend.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- schema.sql now includes this column for fresh setups.
--
-- Plain text holding 'Single Origin' or 'Blend', constrained by the form's two
-- chips rather than a check constraint — same approach as `process` and
-- `roast_level`, and it leaves room to add a third case (say 'House Blend')
-- without a migration.
--
-- Deliberately nullable with no default: existing brews genuinely don't record
-- this, and the chips are deselectable so "not recorded" stays expressible
-- rather than being silently defaulted to one or the other.

alter table brews add column if not exists bean_type text;
