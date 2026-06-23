-- Adds outreach tracking to an existing NuKava CRM database.
-- Run once in the Supabase SQL editor. Fresh setups already include it.

-- Per-person outreach status (Not contacted / Messaged / Awaiting reply /
-- Replied / Following up / Closed)
alter table public.contacts
  add column if not exists outreach_status text not null default 'Not contacted';

-- Message direction on the interaction log (sent vs received)
alter table public.interactions
  add column if not exists direction text not null default 'outbound';
