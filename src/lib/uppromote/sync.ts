// UpPromote → CRM backfill (read-only toward UpPromote).
//
// Layers: this module is the initial-backfill + manual "Sync now" engine.
// Webhooks and scheduled reconciliation build on the same upserts later.
//
// Rules enforced here:
//   - Idempotent upserts keyed on UpPromote ids — re-running never duplicates.
//   - Only UpPromote-owned columns are written; CRM-owned fields (lifecycle,
//     tier, notes, contact_id) are never overwritten by a sync.
//   - Nothing is ever deleted.
//   - Uncertain contact matches go to duplicate_review, never auto-merge.
//   - Every run (including dry runs) is recorded in sync_runs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { upGetAll, uppromoteConfigured } from "./client";
import { mapAffiliate, mapCoupon, mapPayment, mapReferral } from "./map";
import {
  FIXTURE_AFFILIATES,
  FIXTURE_COUPONS,
  FIXTURE_PAYMENTS,
  FIXTURE_REFERRALS,
} from "./fixtures";

export interface BackfillOptions {
  dryRun: boolean;
  demo: boolean; // fixtures instead of live API; forces dryRun semantics for data
}

export interface BackfillResult {
  ok: boolean;
  dryRun: boolean;
  demo: boolean;
  runId: string | null;
  counts: Record<string, number>;
  errors: string[];
}

type Sb = SupabaseClient;

export async function runBackfill(sb: Sb, opts: BackfillOptions): Promise<BackfillResult> {
  const demo = opts.demo && !uppromoteConfigured();
  const dryRun = opts.dryRun || demo; // demo data must never be written
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  // Record the run (demo runs are logged too, clearly flagged in counts).
  let runId: string | null = null;
  const { data: runRow } = await sb
    .from("sync_runs")
    .insert({ provider: "uppromote", kind: "backfill", dry_run: dryRun, status: "running" })
    .select("id")
    .single();
  runId = (runRow?.id as string) ?? null;

  try {
    // ---- 1. Fetch — each collection independently, so one missing/renamed
    // endpoint degrades that collection to empty (with a warning) instead of
    // killing the whole run. Affiliates are the only hard requirement.
    const fetchCollection = async (path: string, required: boolean) => {
      try {
        return await upGetAll(path);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (required) throw e;
        errors.push(`${path} skipped: ${msg}`);
        return [] as Record<string, unknown>[];
      }
    };
    const [affRows, refRows, payRows, couponRows] = demo
      ? [FIXTURE_AFFILIATES, FIXTURE_REFERRALS, FIXTURE_PAYMENTS, FIXTURE_COUPONS]
      : [
          await fetchCollection("/affiliates", true),
          await fetchCollection("/referrals", false),
          await fetchCollection("/payments", false),
          await fetchCollection("/coupons", false),
        ];
    counts.affiliates_fetched = affRows.length;
    counts.referrals_fetched = refRows.length;
    counts.payments_fetched = payRows.length;
    counts.coupons_fetched = couponRows.length;
    if (demo) counts.demo_mode = 1;

    // ---- 2. Ambassadors (UpPromote-owned columns only) ----
    const now = new Date().toISOString();
    const ambassadors = affRows
      .map(mapAffiliate)
      .filter((a) => {
        if (a.uppromote_id === null) {
          errors.push(`Affiliate row with no usable id (email: ${a.email || "?"}) skipped.`);
          return false;
        }
        return true;
      })
      .map((a) => ({ ...a, last_synced_at: now, updated_at: now }));
    counts.ambassadors_upserted = ambassadors.length;

    if (!dryRun && ambassadors.length > 0) {
      const { error } = await sb
        .from("ambassadors")
        .upsert(ambassadors, { onConflict: "uppromote_id" });
      if (error) throw new Error(`ambassadors upsert: ${error.message}`);
    }

    // Map uppromote_id → ambassadors.id for the child tables.
    const idMap = new Map<number, string>();
    if (!dryRun) {
      const upIds = ambassadors.map((a) => a.uppromote_id as number);
      const { data: rows } = await sb
        .from("ambassadors")
        .select("id, uppromote_id")
        .in("uppromote_id", upIds);
      for (const r of rows ?? []) idMap.set(Number(r.uppromote_id), r.id as string);
    }

    // ---- 3. Referrals ----
    const referrals = refRows
      .map(mapReferral)
      .filter((r) => {
        if (r.uppromote_referral_id === null) {
          errors.push("Referral row with no usable id skipped.");
          return false;
        }
        return true;
      })
      .map((r) => ({
        ...r,
        ambassador_id:
          r.uppromote_affiliate_id !== null ? idMap.get(r.uppromote_affiliate_id) ?? null : null,
        synced_at: now,
      }));
    counts.referrals_upserted = referrals.length;
    if (!dryRun && referrals.length > 0) {
      const { error } = await sb
        .from("referrals")
        .upsert(referrals, { onConflict: "uppromote_referral_id" });
      if (error) throw new Error(`referrals upsert: ${error.message}`);
    }

    // ---- 4. Payouts ----
    const payouts = payRows
      .map(mapPayment)
      .filter((p) => {
        if (p.uppromote_payment_id === null) {
          errors.push("Payment row with no usable id skipped.");
          return false;
        }
        return true;
      })
      .map((p) => ({
        ...p,
        ambassador_id:
          p.uppromote_affiliate_id !== null ? idMap.get(p.uppromote_affiliate_id) ?? null : null,
        synced_at: now,
      }));
    counts.payouts_upserted = payouts.length;
    if (!dryRun && payouts.length > 0) {
      const { error } = await sb
        .from("payouts")
        .upsert(payouts, { onConflict: "uppromote_payment_id" });
      if (error) throw new Error(`payouts upsert: ${error.message}`);
    }

    // ---- 5. Coupons ----
    const coupons = couponRows
      .map(mapCoupon)
      .filter((c) => c.code !== "" && c.uppromote_affiliate_id !== null)
      .map((c) => ({
        ambassador_id: idMap.get(c.uppromote_affiliate_id as number) ?? null,
        code: c.code,
        discount: c.discount,
        uppromote_coupon_id: c.uppromote_coupon_id,
      }))
      .filter((c) => c.ambassador_id !== null);
    counts.coupons_upserted = coupons.length;
    if (!dryRun && coupons.length > 0) {
      const { error } = await sb
        .from("ambassador_coupons")
        .upsert(coupons, { onConflict: "ambassador_id,code" });
      if (error) throw new Error(`coupons upsert: ${error.message}`);
    }

    // ---- 6. Link ambassadors to canonical contacts by exact email ----
    // Single exact match → link. Multiple matches → duplicate_review. No
    // match → left unlinked (a later phase decides whether to create contacts).
    if (!dryRun) {
      const { linked, queued } = await linkContacts(sb);
      counts.contacts_linked = linked;
      counts.duplicates_queued = queued;
    } else {
      counts.contacts_linked = 0;
      counts.duplicates_queued = 0;
    }

    // ---- 7. Rollups (computed from mirrored referrals/payouts) ----
    if (!dryRun) {
      counts.rollups_updated = await recomputeRollups(sb, Array.from(idMap.values()));
    }

    const status = errors.length > 0 ? "partial" : "success";
    if (runId) {
      await sb
        .from("sync_runs")
        .update({ status, finished_at: new Date().toISOString(), counts, errors })
        .eq("id", runId);
    }
    return { ok: true, dryRun, demo, runId, counts, errors };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    errors.push(message);
    if (runId) {
      await sb
        .from("sync_runs")
        .update({ status: "error", finished_at: new Date().toISOString(), counts, errors })
        .eq("id", runId);
    }
    return { ok: false, dryRun, demo, runId, counts, errors };
  }
}

async function linkContacts(sb: Sb): Promise<{ linked: number; queued: number }> {
  let linked = 0;
  let queued = 0;
  const { data: unlinked } = await sb
    .from("ambassadors")
    .select("id, uppromote_id, email, first_name, last_name")
    .is("contact_id", null)
    .neq("email", "");
  for (const amb of unlinked ?? []) {
    const email = String(amb.email).toLowerCase();
    const { data: matches } = await sb
      .from("contacts")
      .select("id, name")
      .ilike("email", email)
      .limit(3);
    if (!matches || matches.length === 0) continue;
    if (matches.length === 1) {
      await sb.from("contacts").update({ ambassador_signup: true }).eq("id", matches[0].id);
      await sb.from("ambassadors").update({ contact_id: matches[0].id }).eq("id", amb.id);
      linked++;
    } else {
      // Uncertain — queue once per external id, never auto-merge.
      const { data: existing } = await sb
        .from("duplicate_review")
        .select("id")
        .eq("kind", "ambassador")
        .eq("external_id", String(amb.uppromote_id))
        .eq("status", "Open")
        .limit(1)
        .maybeSingle();
      if (!existing) {
        await sb.from("duplicate_review").insert({
          kind: "ambassador",
          external_id: String(amb.uppromote_id ?? ""),
          external_email: email,
          external_name: `${amb.first_name} ${amb.last_name}`.trim(),
          reason: `${matches.length} contacts share this email.`,
        });
        queued++;
      }
    }
  }
  return { linked, queued };
}

async function recomputeRollups(sb: Sb, ambassadorIds: string[]): Promise<number> {
  if (ambassadorIds.length === 0) return 0;
  const { data: refs } = await sb
    .from("referrals")
    .select("ambassador_id, status, revenue, commission, occurred_at")
    .in("ambassador_id", ambassadorIds);
  const { data: pays } = await sb
    .from("payouts")
    .select("ambassador_id, status, amount")
    .in("ambassador_id", ambassadorIds);

  const agg = new Map<
    string,
    { n: number; revenue: number; commission: number; paid: number; first: string | null; last: string | null }
  >();
  for (const id of ambassadorIds) {
    agg.set(id, { n: 0, revenue: 0, commission: 0, paid: 0, first: null, last: null });
  }
  for (const r of refs ?? []) {
    const a = agg.get(r.ambassador_id as string);
    if (!a) continue;
    const status = String(r.status);
    if (status === "denied" || status === "rejected") continue;
    a.n += 1;
    a.revenue += Number(r.revenue) || 0;
    a.commission += Number(r.commission) || 0;
    const at = r.occurred_at ? String(r.occurred_at) : null;
    if (at) {
      if (!a.first || at < a.first) a.first = at;
      if (!a.last || at > a.last) a.last = at;
    }
  }
  for (const p of pays ?? []) {
    const a = agg.get(p.ambassador_id as string);
    if (!a) continue;
    if (String(p.status) === "paid") a.paid += Number(p.amount) || 0;
  }

  let updated = 0;
  for (const [id, a] of agg) {
    const { error } = await sb
      .from("ambassadors")
      .update({
        total_referrals: a.n,
        total_revenue: a.revenue,
        total_commission: a.commission,
        unpaid_commission: Math.max(0, a.commission - a.paid),
        first_sale_at: a.first,
        last_sale_at: a.last,
      })
      .eq("id", id);
    if (!error) updated++;
  }
  return updated;
}
