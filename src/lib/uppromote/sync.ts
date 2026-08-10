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
import { affiliateCoupons, mapAffiliate, mapCoupon, mapPayment, mapReferral, num } from "./map";
import { aggregateReferrals, emptyRollup, type ReferralRow } from "./rollups";
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
          await fetchCollection("/payments/paid", false), // v2 has no /payments list
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
    counts.referrals_pending = referrals.filter((r) => r.status === "pending").length;
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

    // ---- 5. Coupons — from the /coupons endpoint (has discount values) plus
    // the code strings that ride on each affiliate record.
    const couponByKey = new Map<string, {
      ambassador_id: string | null;
      code: string;
      discount: string;
      uppromote_coupon_id: number | null;
    }>();
    for (const c of couponRows.map(mapCoupon)) {
      if (c.code === "" || c.uppromote_affiliate_id === null) continue;
      const ambassadorId = idMap.get(c.uppromote_affiliate_id) ?? null;
      if (ambassadorId === null) continue;
      couponByKey.set(`${ambassadorId}:${c.code}`, {
        ambassador_id: ambassadorId,
        code: c.code,
        discount: c.discount,
        uppromote_coupon_id: c.uppromote_coupon_id,
      });
    }
    for (const row of affRows) {
      const upId = num(row, ["id", "affiliate_id"]);
      const ambassadorId = upId !== null ? idMap.get(upId) ?? null : null;
      if (ambassadorId === null) continue;
      for (const code of affiliateCoupons(row)) {
        const key = `${ambassadorId}:${code}`;
        if (!couponByKey.has(key)) {
          couponByKey.set(key, {
            ambassador_id: ambassadorId,
            code,
            discount: "",
            uppromote_coupon_id: null,
          });
        }
      }
    }
    const coupons = Array.from(couponByKey.values());
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

    // ---- 6b. Auto-enroll: every ambassador gets a contact and one Planned
    // free sample bottle. Strictly idempotent: never a second contact, never
    // a second bottle, never touches an ambassador with any shipment.
    // Gated by AUTO_ENROLL_SAMPLE_BOTTLE (default on). Dry runs only report.
    const autoEnrollOn = !["false", "0", "off"].includes(
      String(process.env.AUTO_ENROLL_SAMPLE_BOTTLE ?? "true").toLowerCase()
    );
    if (autoEnrollOn) {
      const enroll = await autoEnroll(sb, dryRun);
      counts.contacts_created = enroll.contactsCreated;
      counts.bottles_planned = enroll.bottlesPlanned;
    }

    // ---- 7. Re-link any orphaned referral/payout rows (self-healing:
    // rows synced before their ambassador existed, or whose affiliate id
    // arrived in a shape an older mapper missed, get attached here).
    if (!dryRun) {
      let relinked = 0;
      const { data: orphans } = await sb
        .from("referrals")
        .select("id, uppromote_affiliate_id")
        .is("ambassador_id", null)
        .not("uppromote_affiliate_id", "is", null);
      for (const o of orphans ?? []) {
        const ambId = idMap.get(Number(o.uppromote_affiliate_id));
        if (ambId) {
          await sb.from("referrals").update({ ambassador_id: ambId }).eq("id", o.id);
          relinked++;
        }
      }
      counts.referrals_relinked = relinked;
    }

    // ---- 8. Rollups (computed from mirrored referrals) ----
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

// Referral-derived rollups: sale counts, tracked sales, pending markers,
// first/last sale dates. One shared status rule (rollups.ts): everything
// counts except explicitly voided referrals; pending is tracked separately.
// Commission totals are NOT touched here — the affiliate record's
// paid/approved/pending amounts are authoritative and land in the upsert.
async function recomputeRollups(sb: Sb, ambassadorIds: string[]): Promise<number> {
  if (ambassadorIds.length === 0) return 0;
  const { data: refs } = await sb
    .from("referrals")
    .select("ambassador_id, status, revenue, occurred_at")
    .in("ambassador_id", ambassadorIds);

  const agg = aggregateReferrals((refs ?? []) as ReferralRow[]);
  let updated = 0;
  for (const id of ambassadorIds) {
    const a = agg.get(id) ?? emptyRollup();
    const { error } = await sb.from("ambassadors").update(a).eq("id", id);
    if (!error) updated++;
  }
  return updated;
}

// Auto-enrollment: link-or-create a contact for every ambassador, then plan
// exactly one free sample bottle for anyone who has no shipment in ANY
// status. In dry-run mode this only counts what it would do.
async function autoEnroll(
  sb: Sb,
  dryRun: boolean
): Promise<{ contactsCreated: number; bottlesPlanned: number }> {
  let contactsCreated = 0;
  let bottlesPlanned = 0;
  const ts = new Date().toISOString();

  // 1. Ambassadors still unlinked after the email-match pass have no
  // matching contact — create one (same shape as the UI button).
  const { data: unlinked } = await sb
    .from("ambassadors")
    .select("id, email, first_name, last_name, instagram, tiktok")
    .is("contact_id", null);
  let newContactBottles = 0;
  for (const amb of unlinked ?? []) {
    if (dryRun) {
      // Predict: an exact email match would be linked, not created.
      const email = String(amb.email || "").toLowerCase();
      if (email) {
        const { data: m } = await sb.from("contacts").select("id").ilike("email", email).limit(1);
        if (m && m.length > 0) continue;
      }
      contactsCreated++;
      newContactBottles++;
      continue;
    }
    contactsCreated++;
    const { data: coupon } = await sb
      .from("ambassador_coupons")
      .select("code")
      .eq("ambassador_id", amb.id)
      .limit(1)
      .maybeSingle();
    const name = `${amb.first_name} ${amb.last_name}`.trim() || String(amb.email || "Ambassador");
    const { data: created, error } = await sb
      .from("contacts")
      .insert({
        name,
        email: String(amb.email || ""),
        instagram: String(amb.instagram || ""),
        tiktok: String(amb.tiktok || ""),
        contact_type: "Ambassador",
        status: "Ambassador Signed Up",
        source: "UpPromote",
        outreach_status: "Not contacted",
        ambassador_signup: true,
        discount_code: coupon?.code ?? "",
        created_at: ts,
        updated_at: ts,
      })
      .select("id")
      .single();
    if (!error && created) {
      await sb.from("ambassadors").update({ contact_id: created.id }).eq("id", amb.id);
    } else {
      contactsCreated--; // insert failed; don't overcount
    }
  }

  // 2. One Planned bottle for every linked ambassador with no shipment at all.
  const { data: linkedAmbs } = await sb
    .from("ambassadors")
    .select("id, contact_id, wants_sample")
    .not("contact_id", "is", null);
  // wants_sample false = they declined the free bottle at signup; null = legacy
  // signups from before intake existed (keep enrolling those).
  const contactIds = (linkedAmbs ?? [])
    .filter((a) => a.wants_sample !== false)
    .map((a) => a.contact_id as string)
    .filter(Boolean);
  bottlesPlanned += newContactBottles; // dry-run: new contacts have no shipments yet
  if (contactIds.length === 0) return { contactsCreated, bottlesPlanned };
  const { data: existing } = await sb
    .from("sample_shipments")
    .select("contact_id")
    .in("contact_id", contactIds);
  const hasShipment = new Set((existing ?? []).map((r) => r.contact_id as string));
  for (const cid of contactIds) {
    if (hasShipment.has(cid)) continue;
    hasShipment.add(cid); // guard against duplicate contact_ids in the roster
    bottlesPlanned++;
    if (dryRun) continue;
    await sb.from("sample_shipments").insert({
      contact_id: cid,
      quantity: 1,
      status: "Planned",
      notes: "Auto-enrolled: free ambassador sample bottle",
    });
  }
  return { contactsCreated, bottlesPlanned };
}
