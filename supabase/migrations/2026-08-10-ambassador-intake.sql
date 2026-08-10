-- Ambassador intake: capture what the nukava.co/ambassador signup form
-- collects (the CRM previously never saw phone/address/socials/consent).
-- Additive only.
alter table public.ambassadors
  add column if not exists phone            text not null default '',
  add column if not exists shipping_address text not null default '',
  add column if not exists city             text not null default '',
  add column if not exists state            text not null default '',
  add column if not exists zip              text not null default '',
  add column if not exists wants_sample     boolean,          -- null = unknown (pre-intake signups)
  add column if not exists agreed_terms_at  timestamptz,
  add column if not exists signup_source    text not null default '',
  add column if not exists signup_ip        text not null default '';

-- Raw application retention (passwords are never sent here).
create table if not exists public.ambassador_applications (
  id             uuid primary key default gen_random_uuid(),
  ambassador_id  uuid references public.ambassadors(id) on delete set null,
  email          text not null default '',
  payload        jsonb not null default '{}',
  payload_hash   text not null default '',
  source         text not null default 'nukava.co/ambassador',
  created_at     timestamptz not null default now()
);

-- Identical re-submissions dedupe (idempotent intake).
create unique index if not exists ambassador_applications_dedupe_idx
  on public.ambassador_applications(email, payload_hash) where payload_hash <> '';
create index if not exists ambassador_applications_created_idx
  on public.ambassador_applications(created_at desc);

alter table public.ambassador_applications enable row level security;
drop policy if exists "authed full access ambassador_applications" on public.ambassador_applications;
create policy "authed full access ambassador_applications"
  on public.ambassador_applications for all to authenticated using (true) with check (true);
