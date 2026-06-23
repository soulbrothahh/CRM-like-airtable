-- Migration: outreach sequences (multi-step cadences)
-- Run this in the Supabase SQL Editor if your project predates the sequences feature.

-- 1) The sequences table
create table if not exists public.sequences (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  description text not null default '',
  steps       jsonb not null default '[]',  -- [{day, channel, label, body}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2) Enrollment columns on contacts
alter table public.contacts add column if not exists sequence_id uuid;
alter table public.contacts add column if not exists sequence_step integer not null default 0;
alter table public.contacts add column if not exists sequence_started date;

create index if not exists contacts_sequence_id_idx on public.contacts(sequence_id);

-- 3) Row Level Security (authenticated users only)
alter table public.sequences enable row level security;

drop policy if exists "authed full access sequences" on public.sequences;
create policy "authed full access sequences"
  on public.sequences for all to authenticated
  using (true) with check (true);
