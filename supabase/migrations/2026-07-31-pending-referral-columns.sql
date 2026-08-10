-- Pending vs. earned visibility on ambassadors.
-- total_commission stays the all-in figure (paid + approved + pending).
-- approved_commission is what is actually owed now (approved, unpaid).
-- pending_referrals / pending_revenue mark sales awaiting approval.
-- Backfilled by the next sync run; defaults keep existing rows sane.
alter table public.ambassadors
  add column if not exists pending_referrals  integer not null default 0,
  add column if not exists pending_revenue    numeric not null default 0,
  add column if not exists approved_commission numeric not null default 0;
