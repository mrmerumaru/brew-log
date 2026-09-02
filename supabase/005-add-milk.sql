-- Migration 005 — record the milk used, for milk-based drinks.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- schema.sql now includes these columns for fresh setups.
--
-- Two columns rather than one free-text field: brand and kind vary
-- independently (Greenfields fresh vs Greenfields low fat), and keeping them
-- apart means each gets its own autocomplete from your own history.
--
-- Both optional — an espresso or long black simply leaves them empty, and the
-- app hides the milk line entirely when they are.

alter table brews add column if not exists milk_brand text;
alter table brews add column if not exists milk_type text;
