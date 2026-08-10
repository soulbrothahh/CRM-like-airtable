import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { findShipmentInfo, shopifyConfigured } from "@/lib/shopify";
import { advances } from "@/lib/bottleStatus";

// Pull a linked ambassador's Shopify order info (address + tracking) onto
// their sample shipment. Read-only toward Shopify. Auth: Supabase user token.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // batch mode walks the whole roster

async function authorized(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return false;
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  return !error && Boolean(data.user);
}

async function pullForAmbassador(
  sb: NonNullable<ReturnType<typeof getAdminClient>>,
  amb: { id: string; contact_id: string | null; email: string; first_name: string; last_name: string }
): Promise<{ found: boolean; order?: string; status?: string; skipped?: string }> {
  if (!amb.contact_id) return { found: false, skipped: "no contact" };
  const { data: contact } = await sb
    .from("contacts")
    .select("phone, email")
    .eq("id", amb.contact_id)
    .maybeSingle();
  const info = await findShipmentInfo(
    String(amb.email || contact?.email || ""),
    String(contact?.phone || "")
  );
  if (!info) return { found: false };

  const nextStatus =
    info.fulfillmentStatus === "delivered"
      ? "Delivered"
      : info.trackingNumber || info.shippedAt
        ? "Shipped"
        : "Ready";
  const { data: open } = await sb
    .from("sample_shipments")
    .select("id, status")
    .eq("contact_id", amb.contact_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Forward-only: hand-delivered / manually-advanced bottles are never
  // downgraded or re-stamped by the batch job.
  if (open && !advances(String(open.status), nextStatus)) {
    return { found: true, order: info.orderName, status: String(open.status), skipped: "no forward move" };
  }
  const patch = {
    shipping_name: info.shippingName,
    shipping_address: info.shippingAddress,
    tracking_number: info.trackingNumber,
    status: nextStatus,
    shipped_at: info.shippedAt ? info.shippedAt.slice(0, 10) : null,
    delivered_at: info.deliveredAt ? info.deliveredAt.slice(0, 10) : null,
    updated_at: new Date().toISOString(),
  };
  if (open) {
    await sb.from("sample_shipments").update(patch).eq("id", open.id);
  } else {
    await sb.from("sample_shipments").insert({
      contact_id: amb.contact_id,
      quantity: 1,
      notes: `Shopify order ${info.orderName}`,
      ...patch,
    });
  }
  if (nextStatus === "Delivered") {
    const who = `${amb.first_name} ${amb.last_name}`.trim() || amb.email;
    const title = `Follow up with ${who} — bottles delivered, content posted?`;
    // Idempotent: one follow-up task per contact+title, ever.
    const { data: dupe } = await sb
      .from("tasks")
      .select("id")
      .eq("contact_id", amb.contact_id)
      .eq("title", title)
      .limit(1)
      .maybeSingle();
    if (!dupe) {
      const due = new Date();
      due.setDate(due.getDate() + 3);
      await sb.from("tasks").insert({
        title,
        notes: `Shopify shows order ${info.orderName} delivered. Check in and nudge the first post.`,
        due_date: due.toISOString().slice(0, 10),
        contact_id: amb.contact_id,
      });
    }
  }
  return { found: true, order: info.orderName, status: nextStatus };
}

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!shopifyConfigured()) {
    return NextResponse.json(
      { error: "Shopify is not connected. Set SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET / SHOPIFY_STORE_DOMAIN in Vercel." },
      { status: 503 }
    );
  }
  const sb = getAdminClient();
  if (!sb) return NextResponse.json({ error: "Cloud is not configured." }, { status: 503 });

  const { ambassador_id } = (await req.json().catch(() => ({}))) as { ambassador_id?: string };

  // ---- Single mode ----
  if (ambassador_id) {
    const { data: amb } = await sb
      .from("ambassadors")
      .select("id, contact_id, email, first_name, last_name")
      .eq("id", ambassador_id)
      .maybeSingle();
    if (!amb?.contact_id) {
      return NextResponse.json(
        { error: "Link this ambassador to a contact first — shipments attach to contacts." },
        { status: 400 }
      );
    }
    try {
      const r = await pullForAmbassador(sb, amb);
      return NextResponse.json(
        r.found
          ? { ok: true, found: true, order: r.order, status: r.status }
          : { ok: true, found: false, message: "No Shopify customer/order matched their email or phone yet." }
      );
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Shopify lookup failed." },
        { status: 502 }
      );
    }
  }

  // ---- Batch mode: every linked ambassador whose latest shipment isn't
  // Delivered/Followed up yet. Safe to run repeatedly. ----
  const { data: ambs } = await sb
    .from("ambassadors")
    .select("id, contact_id, email, first_name, last_name")
    .not("contact_id", "is", null);
  const contactIds = (ambs ?? []).map((a) => a.contact_id as string);
  const { data: ships } = contactIds.length
    ? await sb.from("sample_shipments").select("contact_id, status").in("contact_id", contactIds)
    : { data: [] };
  const doneContacts = new Set(
    (ships ?? [])
      .filter((sh) => ["Delivered", "Followed up"].includes(String(sh.status)))
      .map((sh) => sh.contact_id as string)
  );
  let updated = 0;
  let matched = 0;
  let checked = 0;
  const errors: string[] = [];
  for (const amb of ambs ?? []) {
    if (doneContacts.has(amb.contact_id as string)) continue;
    checked++;
    try {
      const r = await pullForAmbassador(sb, amb);
      if (r.found) matched++;
      if (r.found && !r.skipped) updated++;
    } catch (e) {
      errors.push(
        `${`${amb.first_name} ${amb.last_name}`.trim() || amb.email}: ${e instanceof Error ? e.message : "lookup failed"}`
      );
      if (errors.length >= 5) break; // don't hammer a failing API
    }
    await new Promise((r2) => setTimeout(r2, 350)); // stay polite to Shopify rate limits
  }
  return NextResponse.json({ ok: true, batch: true, checked, matched, updated, errors });
}
