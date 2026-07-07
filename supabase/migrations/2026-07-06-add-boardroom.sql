-- Migration: the Boardroom (autonomous agent board meetings)
-- Run this in the Supabase SQL Editor if your project predates the Boardroom feature.
--
-- Three tables power the daily 6 AM meeting:
--   board_meetings — one row per meeting run (objectives, summary, status)
--   agent_reports  — what each agent (CEO, CMO, Sales, …) reported in a meeting
--   agent_memory   — the shared memory agents read every morning and write into,
--                    so context compounds day over day

create table if not exists public.board_meetings (
  id            uuid primary key default gen_random_uuid(),
  meeting_date  date not null default current_date,
  trigger       text not null default 'manual', -- 'cron' | 'manual'
  status        text not null default 'running', -- 'running' | 'completed' | 'failed'
  objectives    jsonb not null default '[]'::jsonb, -- CEO's objectives for the day
  summary       text not null default '',           -- CEO's closing synthesis
  error         text not null default '',
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists board_meetings_date_idx on public.board_meetings(meeting_date desc);

create table if not exists public.agent_reports (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.board_meetings(id) on delete cascade,
  agent_role   text not null,                       -- 'ceo' | 'cmo' | 'sales' | 'researcher' | 'analyst' | 'developer'
  headline     text not null default '',            -- one-line takeaway
  report       text not null default '',            -- full report (markdown)
  action_items jsonb not null default '[]'::jsonb,  -- [{title, detail, impact}]
  position     int not null default 0,              -- display order
  created_at   timestamptz not null default now()
);

create index if not exists agent_reports_meeting_idx on public.agent_reports(meeting_id);

create table if not exists public.agent_memory (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid references public.board_meetings(id) on delete set null,
  agent_role   text not null,
  kind         text not null default 'note',        -- 'insight' | 'decision' | 'metric' | 'note'
  content      text not null,
  created_at   timestamptz not null default now()
);

create index if not exists agent_memory_created_idx on public.agent_memory(created_at desc);

alter table public.board_meetings enable row level security;
alter table public.agent_reports  enable row level security;
alter table public.agent_memory   enable row level security;

drop policy if exists "authed full access board_meetings" on public.board_meetings;
create policy "authed full access board_meetings"
  on public.board_meetings for all to authenticated
  using (true) with check (true);

drop policy if exists "authed full access agent_reports" on public.agent_reports;
create policy "authed full access agent_reports"
  on public.agent_reports for all to authenticated
  using (true) with check (true);

drop policy if exists "authed full access agent_memory" on public.agent_memory;
create policy "authed full access agent_memory"
  on public.agent_memory for all to authenticated
  using (true) with check (true);
