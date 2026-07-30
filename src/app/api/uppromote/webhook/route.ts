import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual, createHash } from "crypto";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { affiliateCoupons, mapAffiliate, mapPayment, mapReferral } from "@/lib/uppromote/map";

// UpPromote webhook receiver.
//
// Every request is verified with HMAC-SHA256 over the RAW body using
// UPPROMOTE_WEBHOOK_SECRET (constant-time compare; both X-Signature and
// X-UpPromote-Signature header spellings accepted — the docs gate automated
// reading, so the real name is confirmed on first delivery). Events are
// stored idempotently in webhook_events (replays are acknowledged and
// skipped), then applied with the same upserts the backfill uses.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verified(raw: string, req: Request): boolean {
  const secret = process.env.UPPROMOTE_WEBHOOK_SECRET;
  if (!secret) return false; // unverifiable → never process
  const given =
    req.headers.get("x-signature") ||
    req.headers.get("x-uppromote-signature") ||
    "";
  if (!given) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(expected.toLowerCase());
  const b = Buffer.from(given.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!process.env.UPPROMOTE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhooks are not configured. Set UPPROMOTE_WEBHOOK_SECRET in Vercel." },
      { status: 503 }
    );
  }
  if (!verified(raw, req)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  const sb = getAdminClient();
  if (!sb) {
    return NextResponse.json({ error: "Cloud is not configured." }, { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Event envelope is confirmed at runtime: topic/event/type for the name,
  // data (or the payload itself) for the record.
  const eventType = String(payload.topic ?? payload.event ?? payload.type ?? "unknown");
  const row = (payload.data && typeof payload.data === "object"
    ? payload.data
    : payload) as Record<string, unknown>;
  // Stable id for replay-dedupe: provider event id when present, else a hash
  // of the raw body (identical redelivery → identical hash → skipped).
  const externalId = String(
    payload.webhook_id ?? payload.event_id ?? createHash("sha256").update(raw).digest("hex")
  );

  const { error: insErr } = await sb.from("webhook_events").insert({
    provider: "uppromote",
    event_type: eventType,
    external_id: externalId,
    payload,
  });
  if (insErr) {
    // Unique violation = replay of an already-stored event: acknowledge, skip.
    if (insErr.code === "23505") return NextResponse.json({ ok: true, replay: true });
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Apply the event with the same idempotent upserts the backfill uses.
  let error = "";
  try {
    const now = new Date().toISOString();
    if (eventType.startsWith("affiliate")) {
      const amb = mapAffiliate(row);
      if (amb.uppromote_id !== null) {
        const { error: e } = await sb
          .from("ambassadors")
          .upsert([{ ...amb, last_synced_at: now, updated_at: now }], {
            onConflict: "uppromote_id",
          });
        if (e) throw new Error(e.message);
        // Attach coupons riding on the record and link by exact email.
        const { data: saved } = await sb
          .from("ambassadors")
          .select("id, contact_id, email")
          .eq("uppromote_id", amb.uppromote_id)
          .maybeSingle();
        if (saved) {
          for (const code of affiliateCoupons(row)) {
            await sb
              .from("ambassador_coupons")
              .upsert([{ ambassador_id: saved.id, code, discount: "" }], {
                onConflict: "ambassador_id,code",
              });
          }
          if (!saved.contact_id && saved.email) {
            const { data: matches } = await sb
              .from("contacts")
              .select("id")
              .ilike("email", String(saved.email))
              .limit(2);
            if (matches && matches.length === 1) {
              await sb.from("contacts").update({ ambassador_signup: true }).eq("id", matches[0].id);
              await sb.from("ambassadors").update({ contact_id: matches[0].id }).eq("id", saved.id);
            }
          }
        }
      }
    } else if (eventType.startsWith("referral")) {
      const ref = mapReferral(row);
      if (ref.uppromote_referral_id !== null) {
        const { data: amb } = ref.uppromote_affiliate_id
          ? await sb
              .from("ambassadors")
              .select("id")
              .eq("uppromote_id", ref.uppromote_affiliate_id)
              .maybeSingle()
          : { data: null };
        const { error: e } = await sb
          .from("referrals")
          .upsert([{ ...ref, ambassador_id: amb?.id ?? null, synced_at: now }], {
            onConflict: "uppromote_referral_id",
          });
        if (e) throw new Error(e.message);
      }
    } else if (eventType.startsWith("payment")) {
      const pay = mapPayment(row);
      if (pay.uppromote_payment_id !== null) {
        const { data: amb } = pay.uppromote_affiliate_id
          ? await sb
              .from("ambassadors")
              .select("id")
              .eq("uppromote_id", pay.uppromote_affiliate_id)
              .maybeSingle()
          : { data: null };
        const { error: e } = await sb
          .from("payouts")
          .upsert([{ ...pay, ambassador_id: amb?.id ?? null, synced_at: now }], {
            onConflict: "uppromote_payment_id",
          });
        if (e) throw new Error(e.message);
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "processing failed";
  }

  await sb
    .from("webhook_events")
    .update({
      status: error ? "error" : "processed",
      processed_at: new Date().toISOString(),
      error,
    })
    .eq("provider", "uppromote")
    .eq("external_id", externalId);

  // Always 200 once stored — reconciliation (or a re-run) recovers errors;
  // failing here would only cause redeliveries of an event we already hold.
  return NextResponse.json({ ok: true, event: eventType, processed: !error });
}
