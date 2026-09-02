-- Migration 006 — record the grind setting.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- schema.sql now includes these columns for fresh setups.
--
-- From the PRD's Equipment section ("grind size setting"), which never made it
-- into the original schema — the last gap in the PRD's own data model.
--
-- Why a number plus a unit rather than free text:
--
-- Grinders use incompatible scales (Comandante counts clicks from zero, a
-- Baratza Encore is 1-40 stepped, a Niche is a 0-50 dial, a 1Zpresso is
-- rotations-plus-clicks), so a bare number means nothing on its own. But grind
-- settings are never compared *across* grinders — the only question that
-- matters is "what did I set my grinder to when the cup was good?" Within one
-- grinder any consistent notation sorts correctly, so `numeric` keeps the value
-- filterable and sortable, and `numeric` (not integer) covers half-clicks and
-- other micro-adjustment.
--
-- grind_unit is free text ("clicks", "numbers", "rotations", "microns") and
-- autocompletes from your own history, so in practice you set it once per
-- grinder and carry-forward fills it in after that.

alter table brews add column if not exists grind_size numeric;
alter table brews add column if not exists grind_unit text;
