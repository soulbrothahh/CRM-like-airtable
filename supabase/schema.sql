-- ============================================================
-- NuKava CRM — Supabase schema
-- Paste this whole file into the Supabase SQL Editor and click "Run".
-- ============================================================

-- ---------- contacts ----------
create table if not exists public.contacts (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null default '',
  phone                 text not null default '',
  email                 text not null default '',
  instagram             text not null default '',
  tiktok                text not null default '',
  city                  text not null default '',
  state                 text not null default '',
  contact_type          text not null default 'Creator',
  relationship_strength text not null default 'Cold',
  lead_temperature      text not null default 'Cold',
  status                text not null default 'New Lead',
  source                text not null default '',
  follower_count        integer,
  audience_type         text not null default '',
  owner                 text not null default '',
  tags                  text[] not null default '{}',
  event_id              uuid,  -- "Met at" — references events(id)
  outreach_status       text not null default 'Not contacted',
  sequence_id           uuid,  -- enrolled cadence — references sequences(id)
  sequence_step         integer not null default 0,
  sequence_started      date,
  notes                 text not null default '',
  last_contacted_date   date,
  next_follow_up_date   date,
  bottle_recipient      boolean not null default false,
  bottle_priority       text not null default 'Medium',
  bottle_status         text not null default 'Not planned',
  bottle_quantity       integer,
  shipping_name         text not null default '',
  shipping_address      text not null default '',
  tracking_number       text not null default '',
  date_sent             date,
  date_delivered        date,
  posted_content        boolean not null default false,
  ambassador_signup     boolean not null default false,
  discount_code         text not null default '',
  sales_generated       numeric,
  visitor_id            text,  -- stitched anonymous device id (web analytics)
  lead_score            integer not null default 0,
  lead_score_updated_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------- interactions ----------
create table if not exists public.interactions (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  date        date not null default current_date,
  type        text not null default 'Texted',
  direction   text not null default 'outbound',
  notes       text not null default '',
  next_action text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists interactions_contact_id_idx on public.interactions(contact_id);
create index if not exists contacts_updated_at_idx on public.contacts(updated_at desc);
create index if not exists contacts_status_idx on public.contacts(status);
create index if not exists contacts_bottle_status_idx on public.contacts(bottle_status);

-- ---------- deals (B2B pipeline) ----------
create table if not exists public.deals (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null default '',
  company             text not null default '',
  contact_id          uuid references public.contacts(id) on delete set null,
  deal_type           text not null default 'Wholesale',
  stage               text not null default 'Lead',
  value               numeric,
  probability         integer,
  expected_close_date date,
  owner               text not null default '',
  source              text not null default '',
  next_step           text not null default '',
  next_step_date      date,
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- deal_activities ----------
create table if not exists public.deal_activities (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  date        date not null default current_date,
  type        text not null default 'Call',
  notes       text not null default '',
  next_action text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists deals_updated_at_idx on public.deals(updated_at desc);
create index if not exists deals_stage_idx on public.deals(stage);
create index if not exists deal_activities_deal_id_idx on public.deal_activities(deal_id);

-- ---------- events (kalapus, circles, mixers, pop-ups) ----------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  type        text not null default 'Kalapu',
  status      text not null default 'Idea',
  date        date,
  time        text not null default '',
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
create index if not exists contacts_event_id_idx on public.contacts(event_id);

-- ---------- sequences (multi-step outreach cadences) ----------
create table if not exists public.sequences (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  description text not null default '',
  steps       jsonb not null default '[]',  -- [{day, channel, label, body}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists contacts_sequence_id_idx on public.contacts(sequence_id);

-- ---------- tasks (to-dos, optionally linked to a contact or deal) ----------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  notes       text not null default '',
  due_date    date,
  done        boolean not null default false,
  contact_id  uuid references public.contacts(id) on delete cascade,
  deal_id     uuid references public.deals(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tasks_due_date_idx on public.tasks(due_date);
create index if not exists tasks_contact_id_idx on public.tasks(contact_id);

-- ---------- activities (unified signal timeline: web, email, social) ----------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid references public.contacts(id) on delete cascade, -- null = anonymous
  visitor_id  text,           -- device id, used to stitch on form fill
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

-- ============================================================
-- Row Level Security
-- ------------------------------------------------------------
-- The app uses Supabase Auth. These policies allow any LOGGED-IN (authenticated)
-- user full access, and block the public/anon key. So your data is private:
-- nobody can read it without signing in.
--
-- IMPORTANT (one-time): so that only YOU can make an account, go to
--   Supabase → Authentication → Providers → Email
-- create your own account first (sign up once in the app or via the dashboard),
-- then turn OFF "Allow new users to sign up". After that, no one else can register.
--
-- (Prefer strict per-user isolation? See the commented block at the bottom.)
-- ============================================================
alter table public.contacts        enable row level security;
alter table public.interactions    enable row level security;
alter table public.deals           enable row level security;
alter table public.deal_activities enable row level security;
alter table public.events          enable row level security;
alter table public.sequences       enable row level security;
alter table public.activities      enable row level security;
alter table public.tasks           enable row level security;

drop policy if exists "anon full access contacts"      on public.contacts;
drop policy if exists "anon full access interactions"  on public.interactions;
drop policy if exists "authed full access contacts"     on public.contacts;
drop policy if exists "authed full access interactions" on public.interactions;
drop policy if exists "authed full access deals"           on public.deals;
drop policy if exists "authed full access deal_activities" on public.deal_activities;

create policy "authed full access contacts"
  on public.contacts for all to authenticated
  using (true) with check (true);

create policy "authed full access interactions"
  on public.interactions for all to authenticated
  using (true) with check (true);

create policy "authed full access deals"
  on public.deals for all to authenticated
  using (true) with check (true);

create policy "authed full access deal_activities"
  on public.deal_activities for all to authenticated
  using (true) with check (true);

drop policy if exists "authed full access events" on public.events;
create policy "authed full access events"
  on public.events for all to authenticated
  using (true) with check (true);

drop policy if exists "authed full access sequences" on public.sequences;
create policy "authed full access sequences"
  on public.sequences for all to authenticated
  using (true) with check (true);

-- The public tracking endpoint writes via the service-role key, which bypasses
-- RLS. Signed-in users can read/manage activity in the app.
drop policy if exists "authed full access activities" on public.activities;
create policy "authed full access activities"
  on public.activities for all to authenticated
  using (true) with check (true);

drop policy if exists "authed full access tasks" on public.tasks;
create policy "authed full access tasks"
  on public.tasks for all to authenticated
  using (true) with check (true);

-- ============================================================
-- OPTIONAL: strict per-user isolation (each account sees only its own data).
-- Useful if you ever share the project with a teammate. Run this block to
-- replace the policies above:
-- ------------------------------------------------------------
-- alter table public.contacts     add column if not exists user_id uuid default auth.uid();
-- alter table public.interactions add column if not exists user_id uuid default auth.uid();
-- drop policy if exists "authed full access contacts"     on public.contacts;
-- drop policy if exists "authed full access interactions" on public.interactions;
-- create policy "own contacts" on public.contacts for all to authenticated
--   using (user_id = auth.uid()) with check (user_id = auth.uid());
-- create policy "own interactions" on public.interactions for all to authenticated
--   using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- The Boardroom — autonomous agent board meetings
-- (also available standalone in migrations/2026-07-06-add-boardroom.sql)
-- ============================================================

create table if not exists public.board_meetings (
  id            uuid primary key default gen_random_uuid(),
  meeting_date  date not null default current_date,
  trigger       text not null default 'manual',
  status        text not null default 'running',
  objectives    jsonb not null default '[]'::jsonb,
  summary       text not null default '',
  error         text not null default '',
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists board_meetings_date_idx on public.board_meetings(meeting_date desc);

create table if not exists public.agent_reports (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.board_meetings(id) on delete cascade,
  agent_role   text not null,
  headline     text not null default '',
  report       text not null default '',
  action_items jsonb not null default '[]'::jsonb,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists agent_reports_meeting_idx on public.agent_reports(meeting_id);

create table if not exists public.agent_memory (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid references public.board_meetings(id) on delete set null,
  agent_role   text not null,
  kind         text not null default 'note',
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
