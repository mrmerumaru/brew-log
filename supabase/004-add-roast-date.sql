-- Migration 004 — record the beans' roast date.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- schema.sql now includes this column for fresh setups.
--
-- From the PRD's data model ("roast date (optional) and roast level"), which
-- never made it into the original schema. A `date` rather than a timestamp —
-- roasters date bags by the day, and the time of day is meaningless here.
--
-- The app derives days-off-roast from this and the brew's own created_at, so a
-- brew logged weeks ago still reports how fresh the beans were *at the time*,
-- not how old that bag would be today.

alter table brews add column if not exists roast_date date;
