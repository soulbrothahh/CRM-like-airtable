-- Migration: web analytics + unified activity timeline + lead scoring
-- Run this in the Supabase SQL Editor if your project predates these features.

-- 1) Engagement columns on contacts
alter table public.contacts add column if not exists visitor_id text;
alter table public.contacts add column if not exists lead_score integer not null default 0;
alter table public.contacts add column if not exists lead_score_updated_at timestamptz;

-- 2) The activities table (web, email, social signals)
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid references public.contacts(id) on delete cascade, -- null = anonymous
  visitor_id  text,
  source      text not null default 'web',
  type        text not null default 'page_view',
  title       text not null default '',
  url         text not null default '',
  metadata    jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists activities_contact_id_idx on public.activities(contact_id);
create index if not exists activities_visitor_id_idx on public.activities(visitor_id);
create index if not exists activities_occurred_at_idx on public.activities(occurred_at desc);
create index if not exists contacts_lead_score_idx on public.contacts(lead_score desc);

-- 3) Row Level Security. The public tracking endpoint uses the service-role
-- key (which bypasses RLS); signed-in users manage activity in the app.
alter table public.activities enable row level security;

drop policy if exists "authed full access activities" on public.activities;
create policy "authed full access activities"
  on public.activities for all to authenticated
  using (true) with check (true);
