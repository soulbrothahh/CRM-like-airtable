-- Migration: tasks (to-dos, optionally linked to a contact or deal)
-- Run this in the Supabase SQL Editor if your project predates the Tasks feature.

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

alter table public.tasks enable row level security;

drop policy if exists "authed full access tasks" on public.tasks;
create policy "authed full access tasks"
  on public.tasks for all to authenticated
  using (true) with check (true);
