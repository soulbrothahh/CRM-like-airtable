-- Migration: remove the demo/sample records that shipped with schema.sql.
-- Deletes ONLY the exact sample rows (matched by name/title) — your real data
-- is untouched. Skim the names below first: if you ever edited one of these
-- sample rows into a real person, rename it before running this.

-- The 10 sample contacts (and everything hanging off them).
with sample_contacts as (
  select id from public.contacts where name in (
    'Maya Reyes',
    'Devin Carter',
    'Sofia Lin',
    'Jordan Webb',
    'Priya Nair',
    'Coastal Health Market',
    'Alex Tanaka',
    'Bianca Ortiz',
    'Greenleaf Distributors',
    'Tyler Brooks'
  )
)
delete from public.activities where contact_id in (select id from sample_contacts);

delete from public.interactions where contact_id in (
  select id from public.contacts where name in (
    'Maya Reyes','Devin Carter','Sofia Lin','Jordan Webb','Priya Nair',
    'Coastal Health Market','Alex Tanaka','Bianca Ortiz','Greenleaf Distributors','Tyler Brooks'
  )
);

delete from public.tasks where contact_id in (
  select id from public.contacts where name in (
    'Maya Reyes','Devin Carter','Sofia Lin','Jordan Webb','Priya Nair',
    'Coastal Health Market','Alex Tanaka','Bianca Ortiz','Greenleaf Distributors','Tyler Brooks'
  )
);

delete from public.contacts where name in (
  'Maya Reyes','Devin Carter','Sofia Lin','Jordan Webb','Priya Nair',
  'Coastal Health Market','Alex Tanaka','Bianca Ortiz','Greenleaf Distributors','Tyler Brooks'
);

-- The 5 sample deals (and their activity logs / linked tasks).
delete from public.deal_activities where deal_id in (
  select id from public.deals where title in (
    'Coastal Health Market — wholesale',
    'Greenleaf Distributors — PNW distribution',
    'BrightReach Agency — creator bundle',
    'Devin Carter — ambassador renewal',
    'Summit Gyms — sponsorship'
  )
);

delete from public.tasks where deal_id in (
  select id from public.deals where title in (
    'Coastal Health Market — wholesale',
    'Greenleaf Distributors — PNW distribution',
    'BrightReach Agency — creator bundle',
    'Devin Carter — ambassador renewal',
    'Summit Gyms — sponsorship'
  )
);

delete from public.deals where title in (
  'Coastal Health Market — wholesale',
  'Greenleaf Distributors — PNW distribution',
  'BrightReach Agency — creator bundle',
  'Devin Carter — ambassador renewal',
  'Summit Gyms — sponsorship'
);

-- The 4 sample events. Unlink any real contact that points at them first.
update public.contacts set event_id = null where event_id in (
  select id from public.events where name in (
    'SLC Kalapu Night','Provo Wellness Mixer','Park City Farmers Market','Friday Kava Circle'
  )
);

delete from public.events where name in (
  'SLC Kalapu Night','Provo Wellness Mixer','Park City Farmers Market','Friday Kava Circle'
);
