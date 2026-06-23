-- Adds the Events feature to an existing NuKava CRM database.
-- Run this once in the Supabase SQL editor.
-- (Fresh setups from schema.sql already include all of this.)

-- 1. Events table
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  type        text not null default 'Kalapu',
  status      text not null default 'Idea',
  date        date,
  city        text not null default '',
  state       text not null default '',
  venue       text not null default '',
  host        text not null default '',
  goal        text not null default '',
  cost        numeric,
  url         text not null default '',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists events_date_idx on public.events(date);

-- 2. "Met at" link on contacts
alter table public.contacts add column if not exists event_id uuid;
create index if not exists contacts_event_id_idx on public.contacts(event_id);

-- 3. Row Level Security (logged-in users only — matches the rest of the app)
alter table public.events enable row level security;
drop policy if exists "authed full access events" on public.events;
create policy "authed full access events"
  on public.events for all to authenticated
  using (true) with check (true);
