-- Adds a free-form "time" field to events (e.g. "7:00 PM").
-- Run once in the Supabase SQL editor. Fresh setups already include it.

alter table public.events add column if not exists time text not null default '';
