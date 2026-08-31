-- Migration 003 — record what drink was made, not just how it was brewed.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- schema.sql now includes this column for fresh setups.
--
-- `method` is the brewing technique (Pourover, Espresso, Moka Pot). `drink` is
-- what ended up in the cup (Iced Latte, Long Black, Cappuccino) — one method
-- produces many drinks, so they're separate fields rather than one list.
--
-- Existing rows get null, which the app falls back to showing by method. No
-- backfill is needed; fill them in by editing a brew if you want.

alter table brews add column if not exists drink text;
