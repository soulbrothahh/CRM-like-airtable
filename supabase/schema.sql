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
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------- interactions ----------
create table if not exists public.interactions (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  date        date not null default current_date,
  type        text not null default 'Texted',
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

-- ============================================================
-- Seed data (10 sample NuKava contacts). Safe to delete this section.
-- ============================================================
insert into public.contacts
  (name, instagram, tiktok, phone, email, city, state, contact_type,
   relationship_strength, lead_temperature, status, source, follower_count,
   audience_type, owner, notes, last_contacted_date, next_follow_up_date,
   bottle_recipient, bottle_priority, bottle_status, bottle_quantity,
   shipping_name, shipping_address, tracking_number, date_sent, date_delivered,
   posted_content, ambassador_signup, discount_code, sales_generated)
values
  ('Maya Reyes','@maya.wellness','@mayawellness','801-555-0142','maya@mayawellness.co','Salt Lake City','UT','Creator','Warm','Hot','Approved for Bottles','DM on Instagram',84000,'Wellness / fitness','Taylor','Loves adaptogens. Wants a morning routine reel.',current_date-3,current_date-1,true,'VIP','Ready to send',2,'Maya Reyes','245 E 300 S, Salt Lake City, UT 84111','',null,null,false,false,'MAYA15',0),
  ('Devin Carter','@devinlifts','@devinlifts','385-555-0199','devin.carter@gmail.com','Provo','UT','Ambassador','Hot','Hot','Ambassador Signed Up','Gym event',22000,'Strength training','Taylor','Signed ambassador agreement. Posts consistently.',current_date-7,current_date+5,true,'High','Delivered',3,'Devin Carter','88 N University Ave, Provo, UT 84601','1Z999AA10123456784',current_date-14,current_date-11,true,true,'DEVIN10',640),
  ('Sofia Lin','@brightreach','','','sofia@brightreach.agency','Los Angeles','CA','Agency','Warm','Warm','Interested','Referral from Devin',null,'Creator agency (30+ creators)','Taylor','Reps wellness creators. Wants wholesale + seeding.',current_date-2,current_date+2,true,'High','Need address',6,'','','',null,null,false,false,'',0),
  ('Jordan Webb','@jordaneats','@jordaneats','801-555-0177','jordan@webb.com','Lehi','UT','Creator','Cold','Warm','Contacted','Found on TikTok',156000,'Food / lifestyle','Taylor','Big TikTok reach. Asked for more info.',current_date-1,current_date+1,true,'Medium','Want to send',1,'','','',null,null,false,false,'',0),
  ('Priya Nair','@calm.priya','@calmpriya','212-555-0143','priya@calmcollective.co','New York','NY','Creator','Warm','Hot','Posted Content','Event — Wellness Expo',47000,'Mindfulness / mental health','Taylor','Posted unboxing story that converted well.',current_date-9,current_date-2,true,'High','Followed up',2,'Priya Nair','120 W 21st St, New York, NY 10011','9400111899560000000000',current_date-20,current_date-16,true,false,'PRIYA15',310),
  ('Coastal Health Market','@coastalhealthmkt','','619-555-0188','buyer@coastalhealth.com','San Diego','CA','Retailer','Cold','Warm','New Lead','Cold outreach',null,'Local health food retail','Taylor','Independent market. Open to wholesale samples.',null,current_date,true,'Medium','Want to send',4,'Coastal Health Market','1500 Garnet Ave, San Diego, CA 92109','',null,null,false,false,'',0),
  ('Alex Tanaka','@alexoutdoors','@alexoutdoors','801-555-0121','alex.tanaka@gmail.com','Park City','UT','Friend','Close Friend','Hot','Bottle Sent','Personal friend',9000,'Outdoor / adventure','Taylor','Friend who loves the product. Will refer others.',current_date-5,current_date+3,true,'Medium','Sent',2,'Alex Tanaka','55 Main St, Park City, UT 84060','1Z999AA10123456111',current_date-2,null,false,false,'ALEX10',120),
  ('Bianca Ortiz','@miamiglow','@miamiglow','305-555-0166','bianca@miamiglow.co','Miami','FL','Creator','Warm','Warm','Needs Follow-Up','Instagram comment',63000,'Beauty / wellness','Taylor','Interested but went quiet. Needs a nudge.',current_date-12,current_date-4,true,'Medium','Need address',1,'','','',null,null,false,false,'',0),
  ('Greenleaf Distributors','','','503-555-0150','orders@greenleafdist.com','Portland','OR','Wholesale','Cold','Cold','New Lead','Trade show',null,'Regional distributor','Taylor','Distributes to 40+ PNW stores. Wants pricing.',null,current_date+4,false,'Low','Not planned',null,'','','',null,null,false,false,'',0),
  ('Tyler Brooks','@tylerbrooksfit','@tylerbrooksfit','801-555-0133','tyler.brooks@gmail.com','Ogden','UT','Event Contact','Warm','Warm','Interested','Met at NuKava pop-up',14000,'Fitness / supplements','Taylor','Grabbed a sample at the booth, loved it.',current_date-1,current_date+2,true,'Medium','Ready to send',1,'Tyler Brooks','390 Washington Blvd, Ogden, UT 84401','',null,null,false,false,'',0);

-- Sample deals
insert into public.deals
  (title, company, deal_type, stage, value, expected_close_date, owner, source, next_step, next_step_date, notes)
values
  ('Coastal Health Market — wholesale','Coastal Health Market','Wholesale','Qualified',4800,current_date+21,'Taylor','Cold outreach','Send wholesale pricing + sample box',current_date+2,'Independent market, 1 location. Wants to trial 2 SKUs.'),
  ('Greenleaf Distributors — PNW distribution','Greenleaf Distributors','Distribution','Meeting',22000,current_date+40,'Taylor','Trade show','Discovery call with buying team',current_date-1,'Covers 40+ stores in the PNW. Asked for distributor terms.'),
  ('BrightReach Agency — creator bundle','BrightReach Agency','Partnership','Proposal',9000,current_date+14,'Taylor','Referral','Follow up on proposal',current_date+1,'Seeding + wholesale combo across their roster.'),
  ('Devin Carter — ambassador renewal','Devin Carter','Ambassador','Negotiation',1500,current_date+7,'Taylor','Existing ambassador','Agree on monthly content + commission',current_date+3,'Renewing for another quarter, wants higher commission.'),
  ('Summit Gyms — sponsorship','Summit Gyms','Sponsorship','Won',6000,current_date-5,'Taylor','Event contact','Deliver first shipment',current_date+4,'Closed — 3-location gym chain, branded cooler placement.');

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
