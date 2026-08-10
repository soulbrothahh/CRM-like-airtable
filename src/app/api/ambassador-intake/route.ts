import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { parseIntake } from "@/lib/intake";

// Ambassador application intake — called by the nukava.co storefront handler
// after UpPromote registration succeeds. Receives everything the signup form
// collects EXCEPT passwords (which must never be sent here; they are dropped
// defensively if they arrive). Auth: INTAKE_SHARED_SECRET via the
// x-intake-secret header. Idempotent on affiliate id, then email.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function secretOk(req: Request): boolean {
  const secret = process.env.INTAKE_SHARED_SECRET;
  if (!secret) return false; // unconfigured → closed
  const given = req.headers.get("x-intake-secret") ?? "";
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!secretOk(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const sb = getAdminClient();
  if (!sb) return NextResponse.json({ error: "Cloud is not configured." }, { status: 503 });

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  // Passwords must never reach the CRM — drop them before anything is stored.
  delete raw.password;
  delete raw.confirmPassword;
  delete raw.confirm_password;

  const parsed = parseIntake(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  const now = new Date().toISOString();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();

  // ---- Find or create the ambassador: affiliate id first, then email ----
  let amb: { id: string; contact_id: string | null; wants_sample?: boolean | null } | null = null;
  if (d.affiliateId !== null) {
    const { data } = await sb
      .from("ambassadors")
      .select("id, contact_id")
      .eq("uppromote_id", d.affiliateId)
      .maybeSingle();
    amb = data;
  }
  if (!amb) {
    const { data } = await sb
      .from("ambassadors")
      .select("id, contact_id")
      .ilike("email", d.email)
      .limit(1)
      .maybeSingle();
    amb = data;
  }
  const intakeFields = {
    phone: d.phone,
    shipping_address: d.address,
    city: d.city,
    state: d.state,
    zip: d.zip,
    wants_sample: d.wantsSample,
    agreed_terms_at: d.agreeTerms ? now : null,
    signup_source: "nukava.co/ambassador",
    signup_ip: ip,
    instagram: d.instagram,
    tiktok: d.tiktok,
    updated_at: now,
  };
  if (amb) {
    await sb.from("ambassadors").update(intakeFields).eq("id", amb.id);
  } else {
    const { data: created, error } = await sb
      .from("ambassadors")
      .insert({
        uppromote_id: d.affiliateId,
        email: d.email,
        first_name: d.firstName,
        last_name: d.lastName,
        lifecycle: "Applied",
        ...intakeFields,
      })
      .select("id, contact_id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    amb = created;
  }

  // ---- Retain the raw application (deduped on identical resubmission) ----
  const hash = createHash("sha256").update(JSON.stringify(raw)).digest("hex");
  await sb
    .from("ambassador_applications")
    .upsert(
      [{ ambassador_id: amb!.id, email: d.email, payload: raw, payload_hash: hash }],
      { onConflict: "email,payload_hash", ignoreDuplicates: true }
    );

  // ---- Contact: link existing (single exact email match) or create ----
  let contactId = amb!.contact_id;
  if (!contactId) {
    const { data: matches } = await sb.from("contacts").select("id").ilike("email", d.email).limit(2);
    if (matches && matches.length === 1) {
      contactId = matches[0].id as string;
    } else if (!matches || matches.length === 0) {
      const { data: c } = await sb
        .from("contacts")
        .insert({
          name: `${d.firstName} ${d.lastName}`.trim() || d.email,
          email: d.email,
          phone: d.phone,
          instagram: d.instagram,
          tiktok: d.tiktok,
          city: d.city,
          state: d.state,
          shipping_address: d.address ? `${d.address}, ${d.city}, ${d.state} ${d.zip}`.trim() : "",
          contact_type: "Ambassador",
          status: "Ambassador Signed Up",
          source: "UpPromote",
          outreach_status: "Not contacted",
          ambassador_signup: true,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      contactId = (c?.id as string) ?? null;
    } // 2+ matches → leave for the duplicate_review flow on next sync
    if (contactId) {
      await sb.from("contacts").update({ ambassador_signup: true }).eq("id", contactId);
      await sb.from("ambassadors").update({ contact_id: contactId }).eq("id", amb!.id);
    }
  }

  // ---- Sample bottle: only when they asked for one, with the address ----
  let bottlePlanned = false;
  if (d.wantsSample && contactId) {
    const { data: existing } = await sb
      .from("sample_shipments")
      .select("id")
      .eq("contact_id", contactId)
      .limit(1)
      .maybeSingle();
    if (!existing) {
      const fullAddress = [d.address, d.city, `${d.state} ${d.zip}`.trim()]
        .filter(Boolean)
        .join(", ");
      await sb.from("sample_shipments").insert({
        contact_id: contactId,
        quantity: 1,
        status: fullAddress ? "Ready" : "Planned",
        shipping_name: `${d.firstName} ${d.lastName}`.trim(),
        shipping_address: fullAddress,
        notes: "Requested free sample at signup",
      });
      bottlePlanned = true;
    }
  }

  return NextResponse.json({
    ok: true,
    ambassador_id: amb!.id,
    contact_id: contactId,
    bottle_planned: bottlePlanned,
  });
}
