-- ============================================================
-- NuKava Growth OS — Phase 1 foundation
-- Ambassadors (UpPromote mirror), campaigns, multi-shipment
-- sampling, content tracking, sync plumbing, duplicate review,
-- suppression, and audit logs.
--
-- ADDITIVE ONLY: no existing table, column, or policy is
-- modified. Existing bottle-gifting fields on contacts keep
-- powering the Kava Giveaway views; sample_shipments adds
-- many-shipments-per-contact with campaign attribution on top.
--
-- Source-of-truth rules:
--   UpPromote owns  → affiliate status, links, coupons, referral
--                     sales, commission math, payout status.
--   The CRM owns    → lifecycle, tier, notes, tasks, shipments,
--                     content, compliance. Sync never deletes and
--                     never overwrites CRM-owned fields.
--
-- Paste this whole file into the Supabase SQL Editor and Run.
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
