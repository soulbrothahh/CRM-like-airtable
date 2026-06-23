-- Adds the contact "tags" column to an existing NuKava CRM database.
-- Run this once in the Supabase SQL editor if you set up the database
-- before tags existed. (Fresh setups from schema.sql already include it.)

alter table public.contacts
  add column if not exists tags text[] not null default '{}';
