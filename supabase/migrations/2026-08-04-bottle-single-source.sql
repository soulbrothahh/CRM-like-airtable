-- One source of truth for bottles: sample_shipments.
-- Backfills a shipment row for every contact in the legacy Kava Giveaway
-- pipeline (bottle_recipient = true) that has no shipment yet, mapping the
-- old status vocabulary onto the shipment ladder:
--   Sent → Shipped · Delivered → Delivered · Followed up → Followed up
--   Ready to send → Ready · everything else → Planned
-- Idempotent: skips any contact that already has a sample_shipments row.
-- contacts.bottle_* columns are DEPRECATED after this (kept one release;
-- the app no longer writes them).
insert into public.sample_shipments
  (contact_id, quantity, status, shipping_name, shipping_address,
   tracking_number, shipped_at, delivered_at, notes)
select
  c.id,
  coalesce(c.bottle_quantity, 1),
  case c.bottle_status
    when 'Sent' then 'Shipped'
    when 'Delivered' then 'Delivered'
    when 'Followed up' then 'Followed up'
    when 'Ready to send' then 'Ready'
    else 'Planned'
  end,
  c.shipping_name,
  c.shipping_address,
  c.tracking_number,
  c.date_sent,
  c.date_delivered,
  'Backfilled from Kava Giveaway pipeline'
from public.contacts c
where c.bottle_recipient = true
  and not exists (
    select 1 from public.sample_shipments s where s.contact_id = c.id
  );
