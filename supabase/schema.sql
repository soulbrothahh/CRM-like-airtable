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

-- ============================================================
-- Growth OS foundation — ambassadors, campaigns, sampling, sync
-- (also available standalone in migrations/2026-07-28-growth-os-foundation.sql;
-- see that file for full commentary and source-of-truth rules)
-- ============================================================

-- ---------- ambassadors (one row per UpPromote affiliate) ----------
create table if not exists public.ambassadors (
  id                    uuid primary key default gen_random_uuid(),
  contact_id            uuid references public.contacts(id) on delete set null,
  uppromote_id          bigint unique,           -- external id; primary match key
  email                 text not null default '',
  first_name            text not null default '',
  last_name             text not null default '',
  uppromote_status      text not null default '',        -- theirs: pending/approved/inactive…
  lifecycle             text not null default 'Prospect', -- ours: Prospect…Inactive
  tier                  text not null default 'Ambassador', -- ours: Ambassador/Islander/Founding Circle
  program_id            bigint,
  program_name          text not null default '',
  referral_link         text not null default '',
  facebook              text not null default '',
  instagram             text not null default '',
  tiktok                text not null default '',
  website               text not null default '',
  email_verified        boolean,
  w9_on_file            boolean,                 -- status only; never the document
  upline_uppromote_id   bigint,
  -- cached rollups recomputed from referrals/payouts on each sync
  total_referrals       integer not null default 0,
  total_revenue         numeric not null default 0,
  total_commission      numeric not null default 0,
  unpaid_commission     numeric not null default 0,
  first_sale_at         timestamptz,
  last_sale_at          timestamptz,
  uppromote_created_at  timestamptz,
  last_synced_at        timestamptz,
  notes                 text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists ambassadors_contact_id_idx on public.ambassadors(contact_id);
create index if not exists ambassadors_email_idx on public.ambassadors(lower(email));
create index if not exists ambassadors_revenue_idx on public.ambassadors(total_revenue desc);

-- ---------- ambassador_coupons ----------
create table if not exists public.ambassador_coupons (
  id             uuid primary key default gen_random_uuid(),
  ambassador_id  uuid not null references public.ambassadors(id) on delete cascade,
  code           text not null,
  discount       text not null default '',   -- e.g. "10%" — display only, Shopify owns the rule
  uppromote_coupon_id bigint,
  created_at     timestamptz not null default now(),
  unique (ambassador_id, code)
);

create index if not exists ambassador_coupons_ambassador_idx on public.ambassador_coupons(ambassador_id);

-- ---------- referrals (UpPromote referral orders; read-only mirror) ----------
create table if not exists public.referrals (
  id                     uuid primary key default gen_random_uuid(),
  uppromote_referral_id  bigint unique,
  ambassador_id          uuid references public.ambassadors(id) on delete set null,
  uppromote_affiliate_id bigint,
  order_id               text not null default '',
  order_number           text not null default '',
  tracking_type          text not null default '',  -- link / coupon / …
  coupon_code            text not null default '',
  status                 text not null default '',  -- pending/approved/denied/paid…
  revenue                numeric not null default 0,
  commission             numeric not null default 0,
  adjustment             numeric not null default 0,
  occurred_at            timestamptz,
  synced_at              timestamptz not null default now(),
  created_at             timestamptz not null default now()
);

create index if not exists referrals_ambassador_idx on public.referrals(ambassador_id);
create index if not exists referrals_occurred_idx on public.referrals(occurred_at desc);
create index if not exists referrals_status_idx on public.referrals(status);

-- ---------- payouts (UpPromote payments; read-only mirror) ----------
create table if not exists public.payouts (
  id                    uuid primary key default gen_random_uuid(),
  uppromote_payment_id  bigint unique,
  ambassador_id         uuid references public.ambassadors(id) on delete set null,
  uppromote_affiliate_id bigint,
  amount                numeric not null default 0,
  status                text not null default '',
  method                text not null default '',  -- label only; never credentials
  paid_at               timestamptz,
  synced_at             timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create index if not exists payouts_ambassador_idx on public.payouts(ambassador_id);

-- ---------- campaigns (launches, seeding pushes, contests) ----------
create table if not exists public.campaigns (
  id                uuid primary key default gen_random_uuid(),
  name              text not null default '',
  channel           text not null default 'DTC',  -- Shopify/TikTok Shop/DTC/Retail/Wholesale/Custom
  status            text not null default 'Planned', -- Planned/Active/Paused/Complete
  start_date        date,
  end_date          date,
  goal              text not null default '',
  budget            numeric,
  bottles_allocated integer,
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists campaigns_status_idx on public.campaigns(status);

-- ---------- campaign_members (cohorts) ----------
create table if not exists public.campaign_members (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  cohort       text not null default '',
  role         text not null default 'Creator',  -- Creator/Ambassador/Customer/Tester
  status       text not null default 'Invited',
  added_at     timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

create index if not exists campaign_members_contact_idx on public.campaign_members(contact_id);

-- ---------- sample_shipments (many per contact, campaign-attributed) ----------
create table if not exists public.sample_shipments (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid not null references public.contacts(id) on delete cascade,
  campaign_id      uuid references public.campaigns(id) on delete set null,
  quantity         integer not null default 1,
  status           text not null default 'Planned', -- Planned/Ready/Shipped/Delivered/Followed up
  shipping_name    text not null default '',
  shipping_address text not null default '',
  tracking_number  text not null default '',
  cost             numeric,
  shipped_at       date,
  delivered_at     date,
  content_received boolean not null default false,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists sample_shipments_contact_idx on public.sample_shipments(contact_id);
create index if not exists sample_shipments_campaign_idx on public.sample_shipments(campaign_id);
create index if not exists sample_shipments_status_idx on public.sample_shipments(status);

-- ---------- content_posts (delivered creator/ambassador content) ----------
create table if not exists public.content_posts (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  campaign_id     uuid references public.campaigns(id) on delete set null,
  platform        text not null default '',   -- TikTok/Instagram/YouTube/…
  url             text not null default '',
  posted_at       date,
  approval_status text not null default 'Pending', -- Pending/Approved/Needs changes
  usage_rights    boolean not null default false,
  ftc_disclosed   boolean,
  claims_checked  boolean,
  rating          integer,                    -- internal 1–5
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists content_posts_contact_idx on public.content_posts(contact_id);
create index if not exists content_posts_campaign_idx on public.content_posts(campaign_id);

-- ---------- sync_runs (every import/backfill/reconcile, incl. dry runs) ----------
create table if not exists public.sync_runs (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null default 'uppromote',
  kind        text not null default 'backfill', -- backfill/webhook/reconcile
  dry_run     boolean not null default false,
  status      text not null default 'running',  -- running/success/partial/error
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  counts      jsonb not null default '{}',      -- {affiliates: n, referrals: n, …}
  errors      jsonb not null default '[]',
  cursor      jsonb not null default '{}',      -- resume point per collection
  created_at  timestamptz not null default now()
);

create index if not exists sync_runs_started_idx on public.sync_runs(started_at desc);

-- ---------- webhook_events (raw inbound events; processed asynchronously) ----------
create table if not exists public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null default 'uppromote',
  event_type   text not null default '',
  external_id  text,                         -- provider event id for replay-idempotency
  payload      jsonb not null default '{}',
  status       text not null default 'received', -- received/processed/error/skipped
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text not null default ''
);

create unique index if not exists webhook_events_dedupe_idx
  on public.webhook_events(provider, external_id) where external_id is not null;
create index if not exists webhook_events_status_idx on public.webhook_events(status);

-- ---------- duplicate_review (uncertain matches queue — never auto-merge) ----------
create table if not exists public.duplicate_review (
  id                    uuid primary key default gen_random_uuid(),
  kind                  text not null default 'ambassador',
  external_id           text not null default '',
  external_email        text not null default '',
  external_name         text not null default '',
  candidate_contact_id  uuid references public.contacts(id) on delete cascade,
  reason                text not null default '',
  status                text not null default 'Open', -- Open/Linked/Ignored
  created_at            timestamptz not null default now()
);

create index if not exists duplicate_review_status_idx on public.duplicate_review(status);

-- ---------- suppression_entries (opt-outs; automated outreach must check) ----------
create table if not exists public.suppression_entries (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid references public.contacts(id) on delete set null,
  email       text not null default '',
  channel     text not null default 'all',  -- all/email/sms/dm
  reason      text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists suppression_email_idx on public.suppression_entries(lower(email));

-- ---------- audit_logs (manual changes + integration actions) ----------
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor      text not null default '',   -- user email or 'system'/'sync'
  action     text not null default '',
  entity     text not null default '',
  entity_id  text not null default '',
  details    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- ============================================================
-- Row Level Security — same model as the rest of the app:
-- any signed-in user has full access; anon is blocked. Server
-- jobs (sync, webhooks) use the service-role key which bypasses RLS.
-- ============================================================
alter table public.ambassadors         enable row level security;
alter table public.ambassador_coupons  enable row level security;
alter table public.referrals           enable row level security;
alter table public.payouts             enable row level security;
alter table public.campaigns           enable row level security;
alter table public.campaign_members    enable row level security;
alter table public.sample_shipments    enable row level security;
alter table public.content_posts       enable row level security;
alter table public.sync_runs           enable row level security;
alter table public.webhook_events      enable row level security;
alter table public.duplicate_review    enable row level security;
alter table public.suppression_entries enable row level security;
alter table public.audit_logs          enable row level security;

drop policy if exists "authed full access ambassadors" on public.ambassadors;
create policy "authed full access ambassadors"
  on public.ambassadors for all to authenticated using (true) with check (true);

drop policy if exists "authed full access ambassador_coupons" on public.ambassador_coupons;
create policy "authed full access ambassador_coupons"
  on public.ambassador_coupons for all to authenticated using (true) with check (true);

drop policy if exists "authed full access referrals" on public.referrals;
create policy "authed full access referrals"
  on public.referrals for all to authenticated using (true) with check (true);

drop policy if exists "authed full access payouts" on public.payouts;
create policy "authed full access payouts"
  on public.payouts for all to authenticated using (true) with check (true);

drop policy if exists "authed full access campaigns" on public.campaigns;
create policy "authed full access campaigns"
  on public.campaigns for all to authenticated using (true) with check (true);

drop policy if exists "authed full access campaign_members" on public.campaign_members;
create policy "authed full access campaign_members"
  on public.campaign_members for all to authenticated using (true) with check (true);

drop policy if exists "authed full access sample_shipments" on public.sample_shipments;
create policy "authed full access sample_shipments"
  on public.sample_shipments for all to authenticated using (true) with check (true);

drop policy if exists "authed full access content_posts" on public.content_posts;
create policy "authed full access content_posts"
  on public.content_posts for all to authenticated using (true) with check (true);

drop policy if exists "authed full access sync_runs" on public.sync_runs;
create policy "authed full access sync_runs"
  on public.sync_runs for all to authenticated using (true) with check (true);

drop policy if exists "authed full access webhook_events" on public.webhook_events;
create policy "authed full access webhook_events"
  on public.webhook_events for all to authenticated using (true) with check (true);

drop policy if exists "authed full access duplicate_review" on public.duplicate_review;
create policy "authed full access duplicate_review"
  on public.duplicate_review for all to authenticated using (true) with check (true);

drop policy if exists "authed full access suppression_entries" on public.suppression_entries;
create policy "authed full access suppression_entries"
  on public.suppression_entries for all to authenticated using (true) with check (true);

drop policy if exists "authed full access audit_logs" on public.audit_logs;
create policy "authed full access audit_logs"
  on public.audit_logs for all to authenticated using (true) with check (true);


-- ---------- pending vs earned commission (2026-07-31) ----------
-- (also in migrations/2026-07-31-pending-referral-columns.sql)
alter table public.ambassadors
  add column if not exists pending_referrals  integer not null default 0,
  add column if not exists pending_revenue    numeric not null default 0,
  add column if not exists approved_commission numeric not null default 0;
